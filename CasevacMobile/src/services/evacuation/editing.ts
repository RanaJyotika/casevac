/**
 * Going back through an evacuation to see or correct a step already saved.
 *
 * Each step screen (assessment, interventions, handover, prepare
 * evacuation) loads its saved record when it opens and fills the form with
 * it — unless the medic has unsaved changes there (the draft wins). Saving
 * again updates that record in place (same id, so the later steps still
 * point at it) instead of adding a second one, and the evacuation's single
 * history entry is rebuilt from the records as they now are.
 */
import { useEffect, useRef, useState } from 'react';
import { getDraft } from '../navigation/drafts';
import { getPatientHistoryStore } from '../patients/historyStore';
import {
  MOI_OPTIONS,
  getAssessmentStore,
  summarise,
  toDateValue,
  toTimeValue,
  type AssessmentForm,
  type InitialAssessment,
  type MarchKey,
  type Mechanism,
} from './assessment';
import {
  HANDED_OVER_TITLE,
  getEvacuationStore,
  summariseEvacuation,
  type EvacuationForm,
  type EvacuationRecord,
} from './evacuation';
import {
  EMPTY_MANUAL_OFFICER,
  IN_TRANSIT_TITLE,
  getHandoverStore,
  summariseHandover,
  type HandoverForm,
  type HandoverRecord,
} from './handover';
import {
  BLEEDING_METHODS,
  EMPTY_MEDICATION,
  EVACUATION_TITLE,
  getInterventionsStore,
  summariseInterventions,
  type BleedingMethod,
  type InterventionsForm,
  type InterventionsRecord,
  type YesNo,
} from './interventions';

const ASSESSMENT_TITLE = 'Initial casualty assessment';

const yesNo = (v: boolean | null): YesNo | null =>
  v === null ? null : v ? 'YES' : 'NO';
const num = (v: number | null) => (v === null ? '' : String(v));

/* --------------------------- Record → form --------------------------- */

export function assessmentToForm(a: InitialAssessment): AssessmentForm {
  const occurred = a.incident.occurredAt
    ? new Date(a.incident.occurredAt)
    : null;
  const known = new Set<string>(MOI_OPTIONS);
  const mechanisms = a.incident.mechanisms.filter(m => known.has(m));
  const other = a.incident.mechanisms.filter(m => !known.has(m));
  const checked = new Set<MarchKey>(a.march.checked);
  return {
    conscious: a.conscious ? 'YES' : 'NO',
    occurredDate: occurred ? toDateValue(occurred) : null,
    occurredTime: occurred ? toTimeValue(occurred) : null,
    injuryTime: a.incident.injuryTime,
    mechanisms: [
      ...(mechanisms as Mechanism[]),
      ...(other.length ? (['Other'] as Mechanism[]) : []),
    ],
    mechanismOther: other.join(', '),
    injuryCount: num(a.incident.injuryCount),
    status: a.incident.status,
    march: {
      M: checked.has('M'),
      A: checked.has('A'),
      R: checked.has('R'),
      C: checked.has('C'),
      H: checked.has('H'),
    },
    additionalInjury: a.march.additionalInjury,
    hr: num(a.vitals.hr),
    rr: num(a.vitals.rr),
    bpSys: num(a.vitals.bpSys),
    bpDia: num(a.vitals.bpDia),
    spo2: num(a.vitals.spo2),
    temp: num(a.vitals.temp),
    systemicExam: a.vitals.systemicExam,
    rs: a.vitals.rs,
    cvs: a.vitals.cvs,
    pa: a.vitals.pa,
    cns: a.vitals.cns,
    additionalInfo: a.additionalInfo,
  };
}

export function interventionsToForm(r: InterventionsRecord): InterventionsForm {
  const known = new Set<string>(BLEEDING_METHODS);
  const methods = r.interventions.bleedingMethods.filter(m => known.has(m));
  const other = r.interventions.bleedingMethods.filter(m => !known.has(m));
  return {
    bleedingControl: yesNo(r.interventions.bleedingControl),
    bleedingMethods: [
      ...(methods as BleedingMethod[]),
      ...(other.length ? (['Other'] as BleedingMethod[]) : []),
    ],
    bleedingOther: other.join(', '),
    tourniquetTime: r.interventions.tourniquetTime,
    airway: yesNo(r.interventions.airway),
    breathing: yesNo(r.interventions.breathing),
    splinting: yesNo(r.interventions.splinting),
    oxygen: r.interventions.oxygen,
    medication: yesNo(r.interventions.medicationGiven),
    medications: r.interventions.medications.length
      ? r.interventions.medications.map(m => ({ ...m }))
      : r.interventions.medicationGiven
      ? [{ ...EMPTY_MEDICATION }]
      : [],
    triage: r.triage.category,
    injuryLocations: [...r.injuryLocations],
    provisionalDiagnosis: r.triage.provisionalDiagnosis,
    remarks: r.remarks,
  };
}

export function handoverToForm(r: HandoverRecord): HandoverForm {
  const at = new Date(r.initiatedAt);
  const manual = r.officer.source === 'MANUAL';
  return {
    place: r.place,
    date: toDateValue(at),
    time: toTimeValue(at),
    officer: manual ? null : r.officer,
    manualEntry: manual,
    manual: manual
      ? {
          fullName: r.officer.fullName,
          rank: r.officer.rank,
          displayId: r.officer.displayId,
          unit: r.officer.unit,
          designation: r.officer.designation,
        }
      : EMPTY_MANUAL_OFFICER,
    nextAction: r.nextAction,
    nextActionOther: r.nextActionOther,
  };
}

export function evacuationToForm(r: EvacuationRecord): EvacuationForm {
  const at = new Date(r.evacuatedAt);
  return {
    procedure: r.procedure,
    date: toDateValue(at),
    time: toTimeValue(at),
    assistedByMo: r.assistedByMo ? 'YES' : 'NO',
    assistedByNa: r.assistedByNa ? 'YES' : 'NO',
    condition: r.condition,
    conditionNotes: r.conditionNotes,
    mode: r.mode,
  };
}

/* ------------------------------ History ------------------------------ */

/**
 * Rebuilds the evacuation's one history entry (id = assessment id) from the
 * records saved now — after a step was corrected. Same title and detail as
 * saving the steps for the first time would give.
 */
export async function refreshEvacuationHistory(
  assessmentId: string,
): Promise<void> {
  const history = getPatientHistoryStore();
  const [existing, assessment, interventions, handover, evacuation] =
    await Promise.all([
      history.get(assessmentId),
      getAssessmentStore().get(assessmentId),
      getInterventionsStore().findByAssessment(assessmentId),
      getHandoverStore().findByAssessment(assessmentId),
      getEvacuationStore().findByAssessment(assessmentId),
    ]);
  if (!existing || !assessment) {
    return;
  }
  const title = evacuation
    ? HANDED_OVER_TITLE
    : handover
    ? IN_TRANSIT_TITLE
    : interventions
    ? EVACUATION_TITLE
    : ASSESSMENT_TITLE;
  const detail = [
    evacuation ? summariseEvacuation(evacuation) : '',
    handover ? summariseHandover(handover) : '',
    interventions ? summariseInterventions(interventions) : '',
    summarise(assessment),
  ]
    .filter(Boolean)
    .join(' · ');
  await history.upsert({ ...existing, title, detail });
}

/* ------------------------------- Screen ------------------------------- */

/** Shown above Save on a step that was saved before. */
export const SAVED_STEP_NOTICE = {
  title: 'SAVED EARLIER',
  message:
    'These are the answers already saved. Change anything and save again to update this record — the later steps are kept.',
};

/**
 * Loads the record a step screen saved earlier (null = not saved yet) and,
 * unless there is an unsaved draft for this screen, fills the form with it.
 * Returns the record (its id is what Save updates) and whether it is still
 * loading.
 */
export function useSavedStep<R, F>(
  load: () => Promise<R | null>,
  draftKey: string | undefined,
  toForm: (record: R) => F,
  setForm: (form: F) => void,
): { saved: R | null; loading: boolean } {
  const [saved, setSaved] = useState<R | null>(null);
  const [loading, setLoading] = useState(true);
  // Decided once, when the screen opens: typed-but-unsaved input wins.
  const hadDraft = useRef(
    draftKey !== undefined && getDraft(draftKey) !== undefined,
  );
  const latest = useRef({ load, toForm, setForm });
  latest.current = { load, toForm, setForm };

  useEffect(() => {
    let cancelled = false;
    latest.current
      .load()
      .then(record => {
        if (cancelled) {
          return;
        }
        setSaved(record);
        if (record && !hadDraft.current) {
          latest.current.setForm(latest.current.toForm(record));
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return { saved, loading };
}
