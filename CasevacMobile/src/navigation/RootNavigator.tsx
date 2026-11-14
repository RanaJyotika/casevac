/**
 * State-based navigator (dependency-free) with patient tabs.
 *
 * Home has its own screen stack; every casualty being evacuated gets a
 * patient tab with its own stack, so a medic can leave patient 1 mid-form,
 * evacuate patient 3 and come back to patient 1 exactly where they were
 * (unsaved input is kept as a draft per tab — services/navigation/drafts).
 *
 *   Start Evacuation (from Home) → opens a new tab for that patient
 *   ＋                            → new tab: identify the next casualty
 *   Home → Continue              → reopens an evacuation at its next step
 *   ✕                            → closes a tab (saved records stay)
 * Up to MAX_TABS tabs. Open tabs are saved per medic and come back after a
 * restart or the next sign-in. All offline: nothing here needs a network.
 *
 * Clinical screens are reachable only while a clinician session exists.
 * Layout: landscape (≥ 900 dp) shows the patients as a navy side panel
 * (collapsible); portrait shows a navy strip under each screen's top bar.
 * Android Back pops the current tab's stack; at the bottom of a tab it
 * returns to Home (the tab stays open).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  BackHandler,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  PatientPanel,
  PatientStrip,
  type PatientTabView,
} from '../components/PatientTabBar';
import { PatientStripProvider } from './patientStripContext';
import {
  AssessmentScreen,
  type AssessmentPatient,
} from '../screens/AssessmentScreen';
import { EvacuationCompletedScreen } from '../screens/EvacuationCompletedScreen';
import { HandoverScreen } from '../screens/HandoverScreen';
import { HistoryReportScreen } from '../screens/HistoryReportScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { InterventionsScreen } from '../screens/InterventionsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { NewPatientScreen } from '../screens/NewPatientScreen';
import {
  PatientIdentificationScreen,
  type Identification,
} from '../screens/PatientIdentificationScreen';
import { PrepareEvacuationScreen } from '../screens/PrepareEvacuationScreen';
import { ReceivePatientScreen } from '../screens/ReceivePatientScreen';
import { RegisterPatientScreen } from '../screens/RegisterPatientScreen';
import { ScanPatientScreen } from '../screens/ScanPatientScreen';
import { ShareRecordScreen } from '../screens/ShareRecordScreen';
import { resumeEvacuation } from '../services/evacuation/resume';
import {
  STAGE_TEXT,
  loadTabInfo,
  type EvacuationStage,
} from '../services/evacuation/status';
import {
  clearDraftsWithPrefix,
  loadDrafts,
} from '../services/navigation/drafts';
import type { FieldLink } from '../services/patients/fieldRegistry';
import type { HistoryEntry } from '../services/patients/historyStore';
import type { Clinician, TriageCategory } from '../types';

type Screen =
  | { name: 'Home' }
  | { name: 'NewPatient' }
  | { name: 'ScanPatient' }
  | { name: 'PatientIdentification'; result: Identification }
  | { name: 'RegisterPatient'; link: FieldLink }
  | { name: 'Assessment'; patient: AssessmentPatient }
  | {
      name: 'Interventions';
      patient: AssessmentPatient;
      assessment: { id: string; status: TriageCategory | null };
    }
  | {
      name: 'Handover';
      patient: AssessmentPatient;
      assessmentId: string;
      interventionsId: string | null;
    }
  | {
      name: 'PrepareEvacuation';
      patient: AssessmentPatient;
      assessmentId: string;
      handoverId: string | null;
    }
  | {
      name: 'EvacuationCompleted';
      patient: AssessmentPatient;
      assessmentId: string;
    }
  | { name: 'ShareRecord'; assessmentId: string }
  | { name: 'ReceivePatient'; firstCode?: string }
  | { name: 'HistoryReport'; entry: HistoryEntry };

interface PatientTab {
  id: string;
  /** "Patient N" while the casualty is unidentified. */
  number: number;
  stack: Screen[];
}

interface NavState {
  clinician: Clinician | null;
  home: Screen[];
  tabs: PatientTab[];
  /** 'home' or a tab id. */
  active: string;
  nextNumber: number;
}

export const MAX_TABS = 6;
/** At this width or more the patients are a side panel (landscape tablet). */
const PANEL_MIN_WIDTH = 900;
/** The patient panel / strip appears once this many patients are open. */
export const MIN_TABS_FOR_LIST = 2;
const HOME: Screen[] = [{ name: 'Home' }];
const tabsKey = (clinicianId: string) => `casevac.tabs.v1:${clinicianId}`;

const signedOut: NavState = {
  clinician: null,
  home: HOME,
  tabs: [],
  active: 'home',
  nextNumber: 1,
};

function newTabId(): string {
  return `tab-${Date.now().toString(36)}-${Math.floor(
    Math.random() * 1e6,
  ).toString(36)}`;
}

/* ------------------------------ Tab labels ------------------------------ */

function identificationLabel(r: Identification): {
  name: string | null;
  id: string;
} {
  switch (r.method) {
    case 'FIELD':
      return { name: r.patient.fullName, id: r.patient.tempId };
    case 'MANUAL':
      return { name: r.patient.fullName, id: r.patient.displayId };
    case 'TRANSFER':
      return { name: r.patient.name, id: r.patient.displayId };
    case 'QR':
      return r.lookup.status === 'FOUND'
        ? { name: r.lookup.patient.fullName, id: r.lookup.patient.displayId }
        : {
            name: null,
            id: `Wristband ${r.claims.patientId.slice(0, 8).toUpperCase()}`,
          };
  }
}

/** Who the tab is about, and its evacuation (if started). */
function describeTab(tab: PatientTab): {
  name: string | null;
  id: string | null;
  assessmentId: string | null;
} {
  let name: string | null = null;
  let id: string | null = null;
  let assessmentId: string | null = null;
  for (const s of [...tab.stack].reverse()) {
    if (!assessmentId) {
      if (s.name === 'Interventions') {
        assessmentId = s.assessment.id;
      } else if (
        s.name === 'Handover' ||
        s.name === 'PrepareEvacuation' ||
        s.name === 'EvacuationCompleted' ||
        s.name === 'ShareRecord'
      ) {
        assessmentId = s.assessmentId;
      }
    }
    if (id === null) {
      if ('patient' in s) {
        name = s.patient.name;
        id = s.patient.id;
      } else if (s.name === 'PatientIdentification') {
        ({ name, id } = identificationLabel(s.result));
      }
    }
  }
  return { name, id, assessmentId };
}

const STAGE_TONE: Record<EvacuationStage, 'orange' | 'blue' | 'teal'> = {
  NOT_HANDED_OVER: 'orange',
  IN_TRANSIT: 'blue',
  HANDED_OVER: 'teal',
};
/** Where a patient tab is, shown on its card. */
const STEP_LABEL: Record<Screen['name'], string> = {
  Home: 'Home',
  NewPatient: 'Identifying the casualty',
  ScanPatient: 'Scanning wristband',
  RegisterPatient: 'Registering casualty',
  PatientIdentification: 'Patient details',
  Assessment: 'Step 4+5 · Assessment',
  Interventions: 'Step 6+7 · Interventions',
  Handover: 'Step 8 · Handover',
  PrepareEvacuation: 'Step 9 · Prepare evacuation',
  EvacuationCompleted: 'Evacuation completed',
  ShareRecord: 'Handing to next team',
  ReceivePatient: 'Receiving from another tablet',
  HistoryReport: 'Viewing history',
};

const SHORT_STAGE: Record<EvacuationStage, string> = {
  NOT_HANDED_OVER: 'Not handed over',
  IN_TRANSIT: 'In transit',
  HANDED_OVER: STAGE_TEXT.HANDED_OVER,
};

/** Draft key for the form a tab is showing (one per form per evacuation). */
function draftKeyFor(tabId: string, s: Screen): string | undefined {
  switch (s.name) {
    case 'Assessment':
      return `${tabId}:Assessment`;
    case 'Interventions':
      return `${tabId}:Interventions:${s.assessment.id}`;
    case 'Handover':
      return `${tabId}:Handover:${s.assessmentId}`;
    case 'PrepareEvacuation':
      return `${tabId}:PrepareEvacuation:${s.assessmentId}`;
    default:
      return undefined;
  }
}

/* ------------------------------ Navigator ------------------------------ */

export function RootNavigator() {
  const [nav, setNav] = useState<NavState>(signedOut);
  const { width } = useWindowDimensions();
  /** Landscape tablet: patients in a side panel; else a strip. */
  const wide = width >= PANEL_MIN_WIDTH;
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [tabInfo, setTabInfo] = useState<
    Record<string, { stage: EvacuationStage; triage: TriageCategory | null }>
  >({});
  /** Tabs are saved only after this medic's saved tabs were restored. */
  const restoredFor = useRef<string | null>(null);

  const activeStack = (s: NavState): Screen[] =>
    s.active === 'home'
      ? s.home
      : s.tabs.find(t => t.id === s.active)?.stack ?? s.home;

  const withStack = (s: NavState, stack: Screen[]): NavState =>
    s.active === 'home'
      ? { ...s, home: stack }
      : {
          ...s,
          tabs: s.tabs.map(t => (t.id === s.active ? { ...t, stack } : t)),
        };

  const push = useCallback(
    (screen: Screen) => setNav(s => withStack(s, [...activeStack(s), screen])),
    [],
  );
  const replace = useCallback(
    (screen: Screen) =>
      setNav(s => withStack(s, [...activeStack(s).slice(0, -1), screen])),
    [],
  );
  const goHome = useCallback(() => setNav(s => ({ ...s, active: 'home' })), []);

  const closeTabNow = useCallback((id: string) => {
    clearDraftsWithPrefix(`${id}:`);
    setNav(s => ({
      ...s,
      tabs: s.tabs.filter(t => t.id !== id),
      active: s.active === id ? 'home' : s.active,
    }));
  }, []);

  const pop = useCallback(
    () =>
      setNav(s => {
        const stack = activeStack(s);
        if (stack.length > 1) {
          return withStack(s, stack.slice(0, -1));
        }
        if (s.active === 'home') {
          return s;
        }
        // Bottom of a tab: an empty ＋ tab closes; otherwise back to Home.
        if (stack[0]?.name === 'NewPatient') {
          return {
            ...s,
            tabs: s.tabs.filter(t => t.id !== s.active),
            active: 'home',
          };
        }
        return { ...s, active: 'home' };
      }),
    [],
  );

  /** Opens a new patient tab, unless MAX_TABS are already open. */
  const openTab = useCallback(
    (stack: Screen[], resetHome = false) =>
      setNav(s => {
        if (s.tabs.length >= MAX_TABS) {
          Alert.alert(
            'Too many patients open',
            `Up to ${MAX_TABS} patients can be open at once. Close a patient tab (✕) before opening another. Saved records stay on the tablet.`,
          );
          return s;
        }
        const tab: PatientTab = { id: newTabId(), number: s.nextNumber, stack };
        return {
          ...s,
          home: resetHome ? HOME : s.home,
          tabs: [...s.tabs, tab],
          active: tab.id,
          nextNumber: s.nextNumber + 1,
        };
      }),
    [],
  );

  const continueEvacuation = useCallback(
    async (assessmentId: string) => {
      const open = nav.tabs.find(
        t => describeTab(t).assessmentId === assessmentId,
      );
      if (open) {
        setNav(s => ({ ...s, active: open.id }));
        return;
      }
      const next = await resumeEvacuation(assessmentId);
      if (!next) {
        Alert.alert(
          'Not found',
          'This evacuation is not saved on this tablet.',
        );
        return;
      }
      const { step, ...rest } = next;
      openTab([{ name: step, ...rest } as Screen]);
    },
    [nav.tabs, openTab],
  );

  const confirmClose = useCallback(
    (id: string) => {
      const tab = nav.tabs.find(t => t.id === id);
      if (!tab) {
        return;
      }
      const { name } = describeTab(tab);
      const title = name ?? `Patient ${tab.number}`; // same as the tab
      Alert.alert(
        `Close ${title}?`,
        'Everything already saved stays on this tablet — reopen it any time from Home → Continue. Anything typed in this tab but not yet saved is discarded.',
        [
          { text: 'Keep open', style: 'cancel' },
          {
            text: 'Close tab',
            style: 'destructive',
            onPress: () => closeTabNow(id),
          },
        ],
      );
    },
    [nav.tabs, closeTabNow],
  );

  /* ------------------------- Sign-in / persistence ------------------------- */

  const signIn = useCallback((clinician: Clinician) => {
    restoredFor.current = null;
    setNav({ ...signedOut, clinician });
    (async () => {
      await loadDrafts();
      try {
        const raw = await AsyncStorage.getItem(tabsKey(clinician.id));
        const saved = raw ? JSON.parse(raw) : null;
        if (saved && Array.isArray(saved.tabs)) {
          setNav(s =>
            s.clinician?.id === clinician.id
              ? {
                  ...s,
                  tabs: saved.tabs.slice(0, MAX_TABS),
                  nextNumber:
                    typeof saved.nextNumber === 'number' ? saved.nextNumber : 1,
                }
              : s,
          );
        }
      } catch {
        // No saved tabs: start with Home only.
      }
      restoredFor.current = clinician.id;
    })();
  }, []);

  useEffect(() => {
    const id = nav.clinician?.id;
    if (!id || restoredFor.current !== id) {
      return;
    }
    AsyncStorage.setItem(
      tabsKey(id),
      JSON.stringify({ tabs: nav.tabs, nextNumber: nav.nextNumber }),
    ).catch(() => {});
  }, [nav.clinician, nav.tabs, nav.nextNumber]);

  // Triage colour and status for each tab, from the saved records.
  const tabAssessmentIds = nav.tabs
    .map(t => describeTab(t).assessmentId)
    .filter((x): x is string => !!x)
    .join('|');
  useEffect(() => {
    let cancelled = false;
    loadTabInfo(tabAssessmentIds ? tabAssessmentIds.split('|') : [])
      .then(info => !cancelled && setTabInfo(info))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [tabAssessmentIds, nav.active]);

  /* ------------------------------ Android Back ------------------------------ */

  const canGoBack =
    nav.clinician !== null && (nav.active !== 'home' || nav.home.length > 1);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) {
        return false; // default behaviour (leave the app)
      }
      pop();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack, pop]);

  const tabViews: PatientTabView[] = useMemo(
    () =>
      nav.tabs.map(t => {
        const d = describeTab(t);
        const info = d.assessmentId ? tabInfo[d.assessmentId] : undefined;
        return {
          id: t.id,
          title: d.name ?? `Patient ${t.number}`,
          subtitle: d.id ?? 'New patient',
          triage: info?.triage ?? null,
          status: info ? SHORT_STAGE[info.stage] : null,
          statusTone: info ? STAGE_TONE[info.stage] : null,
          step: STEP_LABEL[t.stack[t.stack.length - 1]?.name ?? 'NewPatient'],
        };
      }),
    [nav.tabs, tabInfo],
  );

  if (!nav.clinician) {
    return <LoginScreen onSignIn={signIn} onEmergencyAccess={signIn} />;
  }

  const clinician = nav.clinician;
  const inTab = nav.active !== 'home';
  const activeTab = nav.tabs.find(t => t.id === nav.active);
  const stack = activeStack(nav);
  const screen = stack[stack.length - 1];
  const draftKey = activeTab ? draftKeyFor(activeTab.id, screen) : undefined;

  const content = (() => {
    switch (screen.name) {
      case 'NewPatient':
        return (
          <NewPatientScreen
            number={activeTab?.number ?? nav.nextNumber}
            onBack={pop}
            onScanPatient={() => push({ name: 'ScanPatient' })}
            onPatientIdentified={result =>
              replace({ name: 'PatientIdentification', result })
            }
            onRegisterPatient={link => push({ name: 'RegisterPatient', link })}
          />
        );
      case 'ScanPatient':
        return (
          <ScanPatientScreen
            onBack={pop}
            onIdentified={result =>
              replace({ name: 'PatientIdentification', result })
            }
            onRegisterPatient={() =>
              replace({ name: 'RegisterPatient', link: {} })
            }
            onTransferQr={firstCode =>
              // A transfer QR from another tablet, not a wristband.
              replace({ name: 'ReceivePatient', firstCode })
            }
          />
        );
      case 'PatientIdentification':
        return (
          <PatientIdentificationScreen
            result={screen.result}
            onBack={pop}
            onRegisterNew={link => push({ name: 'RegisterPatient', link })}
            onStartEvacuation={patient =>
              inTab
                ? push({ name: 'Assessment', patient })
                : // From Home: this patient gets their own tab.
                  openTab(
                    [
                      { name: 'PatientIdentification', result: screen.result },
                      { name: 'Assessment', patient },
                    ],
                    true,
                  )
            }
            onOpenHistory={entry => push({ name: 'HistoryReport', entry })}
          />
        );
      case 'HistoryReport':
        return (
          <HistoryReportScreen
            entry={screen.entry}
            onBack={pop}
            onHandOver={assessmentId =>
              push({ name: 'ShareRecord', assessmentId })
            }
          />
        );
      case 'Assessment':
        return (
          <AssessmentScreen
            patient={screen.patient}
            recordedBy={clinician.id}
            draftKey={draftKey}
            onCancel={pop}
            onSaved={record =>
              // Assessment (4 + 5) → Interventions & Triage (6 + 7).
              replace({
                name: 'Interventions',
                patient: screen.patient,
                assessment: { id: record.id, status: record.incident.status },
              })
            }
          />
        );
      case 'Interventions':
        return (
          <InterventionsScreen
            patient={screen.patient}
            assessment={screen.assessment}
            recordedBy={clinician.id}
            draftKey={draftKey}
            onCancel={pop}
            onSaved={record =>
              // 6 + 7 → Handover (8).
              replace({
                name: 'Handover',
                patient: screen.patient,
                assessmentId: screen.assessment.id,
                interventionsId: record.id,
              })
            }
          />
        );
      case 'Handover':
        return (
          <HandoverScreen
            patient={screen.patient}
            assessmentId={screen.assessmentId}
            interventionsId={screen.interventionsId}
            recordedBy={clinician.id}
            draftKey={draftKey}
            onCancel={pop}
            onSaved={record =>
              // 8 → Prepare Evacuation (9); the casualty is "In transit".
              replace({
                name: 'PrepareEvacuation',
                patient: screen.patient,
                assessmentId: screen.assessmentId,
                handoverId: record.id,
              })
            }
          />
        );
      case 'PrepareEvacuation':
        return (
          <PrepareEvacuationScreen
            patient={screen.patient}
            assessmentId={screen.assessmentId}
            handoverId={screen.handoverId}
            recordedBy={clinician.id}
            draftKey={draftKey}
            onCancel={pop}
            onSaved={() =>
              // Final save → Evacuation Completed (10).
              replace({
                name: 'EvacuationCompleted',
                patient: screen.patient,
                assessmentId: screen.assessmentId,
              })
            }
          />
        );
      case 'EvacuationCompleted':
        return (
          <EvacuationCompletedScreen
            patient={screen.patient}
            assessmentId={screen.assessmentId}
            onHandOver={() =>
              push({ name: 'ShareRecord', assessmentId: screen.assessmentId })
            }
            onSummary={entry => push({ name: 'HistoryReport', entry })}
            onNextCasualty={() => openTab([{ name: 'NewPatient' }])}
            onHome={goHome}
          />
        );
      case 'ShareRecord':
        return (
          <ShareRecordScreen
            assessmentId={screen.assessmentId}
            clinician={clinician}
            onBack={pop}
          />
        );
      case 'ReceivePatient':
        return (
          <ReceivePatientScreen
            clinician={clinician}
            firstCode={screen.firstCode}
            onBack={pop}
            onOpenPatient={result =>
              replace({ name: 'PatientIdentification', result })
            }
          />
        );
      case 'RegisterPatient':
        return (
          <RegisterPatientScreen
            registeredBy={clinician.id}
            link={screen.link}
            onCancel={pop}
            onRegistered={patient =>
              replace({
                name: 'PatientIdentification',
                result: { ok: true, method: 'FIELD', patient },
              })
            }
          />
        );
      case 'Home':
      default:
        return (
          <HomeScreen
            clinician={clinician}
            onScanPatient={() => push({ name: 'ScanPatient' })}
            onPatientIdentified={result =>
              push({ name: 'PatientIdentification', result })
            }
            onRegisterPatient={link => push({ name: 'RegisterPatient', link })}
            onReceivePatient={() => push({ name: 'ReceivePatient' })}
            onContinueEvacuation={continueEvacuation}
            onSignOut={() => setNav(signedOut)}
          />
        );
    }
  })();

  const patientProps = {
    tabs: tabViews,
    activeId: nav.active,
    canAdd: nav.tabs.length < MAX_TABS,
    maxTabs: MAX_TABS,
    onSelect: (id: string) => setNav(s => ({ ...s, active: id })),
    onClose: confirmClose,
    onNew: () => openTab([{ name: 'NewPatient' }]),
  };
  /* Keyed per tab and depth: switching tabs remounts the screen, which
     restores that tab's draft instead of reusing another tab's state. */
  const screenView = (
    <View
      key={`${nav.active}:${stack.length}:${screen.name}`}
      style={styles.screen}
    >
      {content}
    </View>
  );

  // The patient list appears only when there is something to switch between:
  // with 0 or 1 open patient, Back returns Home and Home → Continue reopens.
  if (nav.tabs.length < MIN_TABS_FOR_LIST) {
    return screenView;
  }
  // Landscape: navy side panel. Portrait: navy strip under the top bar.
  return wide ? (
    <View style={styles.row}>
      <PatientPanel
        {...patientProps}
        collapsed={panelCollapsed}
        onToggleCollapsed={() => setPanelCollapsed(c => !c)}
      />
      {screenView}
    </View>
  ) : (
    <PatientStripProvider value={<PatientStrip {...patientProps} />}>
      {screenView}
    </PatientStripProvider>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: '#FFFFFF' },
  screen: { flex: 1, minWidth: 0 },
});
