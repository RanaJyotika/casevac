/**
 * DEMO ONLY — loads the fictional casualties in data/sampleCasualties.ts onto
 * this tablet, for client demonstrations. Called when the client-demo
 * account signs in (services/auth/signIn.ts); never for real accounts.
 *
 * Records go into the same stores the screens save to (assessment,
 * interventions, handover, evacuation, patient history, field registry), so
 * every screen works on them: Home dashboard and alerts, Continue
 * evacuation, previous history, Casualty History, Share record.
 *
 * Loaded once per tablet (a marker is kept); records keep fixed IDs, so a
 * second load would add nothing anyway.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import directoryJson from '../../provisioning/demo-identity-directory.json';
import {
  SAMPLE_CASUALTIES,
  type SampleCasualty,
  type SampleEpisode,
} from '../../data/sampleCasualties';
import {
  getAssessmentStore,
  summarise,
  toTimeValue,
  type InitialAssessment,
  type KeyValueStorage,
} from '../evacuation/assessment';
import {
  EVACUATION_TITLE,
  getInterventionsStore,
  summariseInterventions,
  type InterventionsRecord,
} from '../evacuation/interventions';
import {
  getHandoverStore,
  IN_TRANSIT_TITLE,
  officerFromStaff,
  summariseHandover,
  type HandoverRecord,
  type ReceivingOfficer,
} from '../evacuation/handover';
import {
  getEvacuationStore,
  HANDED_OVER_TITLE,
  summariseEvacuation,
  type EvacuationRecord,
} from '../evacuation/evacuation';
import { parseDirectory } from '../identity/bundledDemoProvisioning';
import { getActiveIdentityDirectory } from '../identity/provisioningStore';
import type { IdentityDirectory, StaffMember } from '../identity/types';
import { getFieldRegistry } from '../patients/fieldRegistry';
import { getPatientHistoryStore } from '../patients/historyStore';

const MARKER_KEY = 'casevac.sampleCasualties.v1';

export interface SampleLoadResult {
  /** false = already loaded on this tablet earlier. */
  loaded: boolean;
  casualties: number;
}

interface Who {
  keys: string[];
  label: string;
}

const norm = (s: string) => s.trim().toUpperCase();

/** Directory identity by name, else a field registration (TEMP-…). */
async function identify(
  c: SampleCasualty,
  directory: IdentityDirectory,
  registeredAt: string,
  registeredBy: string,
): Promise<Who> {
  if (c.fullName) {
    const name = norm(c.fullName);
    const candidate = parseDirectory(directoryJson).patients.find(
      p => norm(p.fullName) === name,
    );
    // Must also be in the directory the tablet uses now (it may have been
    // replaced by a download at an earlier online sign-in).
    const found = candidate
      ? await directory.findPatient(candidate.patientId)
      : null;
    if (found) {
      return {
        keys: [found.patientId, found.displayId],
        label: `${found.fullName} (${found.displayId})`,
      };
    }
  }
  await getFieldRegistry().importPatient({
    tempId: c.fallbackTempId,
    fullName: c.fullName,
    rank: c.rank,
    age: c.age,
    sex: c.sex,
    bloodGroup: c.bloodGroup,
    rhFactor: c.rhFactor,
    unit: c.unit,
    registeredAt,
    registeredBy,
    link: {},
  });
  return {
    keys: [c.fallbackTempId],
    label: `${c.fullName ?? 'Unidentified casualty'} (${c.fallbackTempId})`,
  };
}

async function officer(
  h: NonNullable<SampleEpisode['handover']>,
  directory: IdentityDirectory,
): Promise<ReceivingOfficer> {
  const match: StaffMember | undefined = (
    await directory.searchStaff(h.officerName)
  ).find(s => norm(s.fullName) === norm(h.officerName));
  if (match) {
    return officerFromStaff(match);
  }
  return {
    source: 'MANUAL',
    staffId: null,
    displayId: h.officerFallback.displayId,
    fullName: h.officerName,
    rank: h.officerFallback.rank,
    unit: h.officerFallback.unit,
    roleLabel: '',
    designation: h.officerFallback.designation,
    dateOfBirth: null,
    contactPhone: '',
    photo: null,
  };
}

/** Builds the records of one evacuation (pure apart from the officer lookup). */
async function buildEpisode(
  e: SampleEpisode,
  who: Who,
  medicId: string,
  now: number,
  directory: IdentityDirectory,
) {
  const ago = (min: number) => new Date(now - min * 60_000);
  const iso = (min: number) => ago(min).toISOString();
  const recordedBy = e.recordedBy ?? medicId;
  const base = { patientKeys: who.keys, patientLabel: who.label, recordedBy };
  const a = e.assessment;

  const assessment: InitialAssessment = {
    id: `ASM-DEMO-${e.id}`,
    ...base,
    recordedAt: iso(a.minAgo),
    conscious: a.conscious,
    incident: {
      occurredAt: iso(e.injuredMinAgo),
      injuryTime: toTimeValue(ago(e.injuredMinAgo)),
      mechanisms: a.mechanisms,
      injuryCount: a.injuryCount,
      status: a.status,
    },
    march: { checked: a.march, additionalInjury: a.additionalInjury },
    vitals: {
      hr: a.hr,
      rr: a.rr,
      bpSys: a.bp ? a.bp[0] : null,
      bpDia: a.bp ? a.bp[1] : null,
      spo2: a.spo2,
      temp: a.temp,
      systemicExam: a.systemicExam,
      rs: a.rs ?? '',
      cvs: a.cvs ?? '',
      pa: a.pa ?? '',
      cns: a.cns ?? '',
    },
    additionalInfo: a.additionalInfo,
  };

  const i = e.interventions;
  const interventions: InterventionsRecord | null = i
    ? {
        id: `INT-DEMO-${e.id}`,
        assessmentId: assessment.id,
        ...base,
        recordedAt: iso(i.minAgo),
        interventions: {
          bleedingControl: i.bleedingMethods.length > 0,
          bleedingMethods: i.bleedingMethods,
          tourniquetTime:
            i.tourniquetMinAgo !== undefined
              ? toTimeValue(ago(i.tourniquetMinAgo))
              : null,
          airway: i.airway,
          breathing: i.breathing,
          splinting: i.splinting,
          oxygen: i.oxygen,
          medicationGiven: i.medications.length > 0,
          medications: i.medications.map(m => ({
            name: m.name,
            dose: m.dose,
            time: m.minAgo === null ? null : toTimeValue(ago(m.minAgo)),
          })),
        },
        triage: {
          initialStatus: a.status,
          category: i.category,
          provisionalDiagnosis: i.provisionalDiagnosis,
        },
        injuryLocations: i.injuryLocations,
        remarks: i.remarks,
      }
    : null;

  const h = e.handover;
  const handover: HandoverRecord | null = h
    ? {
        id: `HND-DEMO-${e.id}`,
        assessmentId: assessment.id,
        interventionsId: interventions?.id ?? null,
        ...base,
        recordedAt: iso(h.minAgo),
        place: h.place,
        initiatedAt: iso(h.initiatedMinAgo),
        officer: await officer(h, directory),
        nextAction: h.nextAction,
        nextActionOther: '',
      }
    : null;

  const v = e.evacuation;
  const evacuation: EvacuationRecord | null = v
    ? {
        id: `EVC-DEMO-${e.id}`,
        assessmentId: assessment.id,
        handoverId: handover?.id ?? null,
        ...base,
        recordedAt: iso(v.minAgo),
        evacuatedAt: iso(v.evacuatedMinAgo),
        assistedByMo: v.assistedByMo,
        assistedByNa: v.assistedByNa,
        condition: v.condition,
        conditionNotes: v.conditionNotes,
        mode: v.mode,
      }
    : null;

  // One evacuation, one history entry — as the screens leave it.
  const history = {
    id: assessment.id,
    patientKeys: who.keys,
    at: assessment.recordedAt,
    title: evacuation
      ? HANDED_OVER_TITLE
      : handover
      ? IN_TRANSIT_TITLE
      : interventions
      ? EVACUATION_TITLE
      : 'Initial casualty assessment',
    detail: [
      evacuation && summariseEvacuation(evacuation),
      handover && summariseHandover(handover),
      interventions && summariseInterventions(interventions),
      summarise(assessment),
    ]
      .filter(Boolean)
      .join(' · '),
    recordedBy,
  };

  return { assessment, interventions, handover, evacuation, history };
}

/**
 * Loads the sample casualties unless this tablet already has them.
 * `medicId` becomes the recorder of most of them ("My casualties").
 */
export async function loadSampleCasualties(
  medicId: string,
  options: {
    now?: number;
    storage?: KeyValueStorage;
    directory?: IdentityDirectory;
  } = {},
): Promise<SampleLoadResult> {
  const storage = options.storage ?? AsyncStorage;
  if (await storage.getItem(MARKER_KEY)) {
    return { loaded: false, casualties: SAMPLE_CASUALTIES.length };
  }
  const now = options.now ?? Date.now();
  const directory = options.directory ?? getActiveIdentityDirectory();

  const assessments: InitialAssessment[] = [];
  const interventions: InterventionsRecord[] = [];
  const handovers: HandoverRecord[] = [];
  const evacuations: EvacuationRecord[] = [];
  const history = getPatientHistoryStore();

  for (const c of SAMPLE_CASUALTIES) {
    const first = c.episodes[0];
    const who = await identify(
      c,
      directory,
      new Date(now - (first.assessment.minAgo + 1) * 60_000).toISOString(),
      first.recordedBy ?? medicId,
    );
    for (const e of c.episodes) {
      const r = await buildEpisode(e, who, medicId, now, directory);
      assessments.push(r.assessment);
      r.interventions && interventions.push(r.interventions);
      r.handover && handovers.push(r.handover);
      r.evacuation && evacuations.push(r.evacuation);
      await history.upsert(r.history);
    }
  }

  await getAssessmentStore().importRecords(assessments);
  await getInterventionsStore().importRecords(interventions);
  await getHandoverStore().importRecords(handovers);
  await getEvacuationStore().importRecords(evacuations);
  await storage.setItem(MARKER_KEY, new Date(now).toISOString());
  return { loaded: true, casualties: SAMPLE_CASUALTIES.length };
}
