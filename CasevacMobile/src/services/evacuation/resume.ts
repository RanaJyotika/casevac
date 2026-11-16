/**
 * Continue an evacuation: works out the next step still to be saved, from
 * the records on this tablet, and the patient details that screen needs.
 *
 *   assessment only           → Interventions & Triage (6 + 7)
 *   + interventions           → Handover Details (8)
 *   + handover (In transit)   → Prepare Evacuation (9)
 *   + evacuation (Handed over)→ Evacuation Completed (10)
 */
import type { AssessmentPatient } from '../../screens/AssessmentScreen';
import type { TriageCategory } from '../../types';
import { resolvePatient } from '../transfer/transferPackage';
import { getAssessmentStore } from './assessment';
import { getEvacuationStore } from './evacuation';
import { getHandoverStore } from './handover';
import { getInterventionsStore } from './interventions';

/** The saved steps behind the next one, so Back can walk through them. */
export interface ResumeTrail {
  assessmentId: string;
  /** Status recorded in the assessment (pre-fills triage in 6 + 7). */
  status: TriageCategory | null;
  interventionsId: string | null;
  handoverId: string | null;
}

export type ResumeStep = { trail: ResumeTrail } & (
  | {
      step: 'Interventions';
      patient: AssessmentPatient;
      assessment: { id: string; status: TriageCategory | null };
    }
  | {
      step: 'Handover';
      patient: AssessmentPatient;
      assessmentId: string;
      interventionsId: string | null;
    }
  | {
      step: 'PrepareEvacuation';
      patient: AssessmentPatient;
      assessmentId: string;
      handoverId: string | null;
    }
  | {
      step: 'EvacuationCompleted';
      patient: AssessmentPatient;
      assessmentId: string;
    }
);

export async function resumeEvacuation(
  assessmentId: string,
): Promise<ResumeStep | null> {
  const assessment = await getAssessmentStore().get(assessmentId);
  if (!assessment) {
    return null;
  }
  const [interventions, handover, evacuation, who] = await Promise.all([
    getInterventionsStore().findByAssessment(assessmentId),
    getHandoverStore().findByAssessment(assessmentId),
    getEvacuationStore().findByAssessment(assessmentId),
    resolvePatient(assessment.patientKeys, assessment.patientLabel),
  ]);
  const patient: AssessmentPatient = {
    name: who.name,
    idLabel: who.temporary ? 'Temporary ID' : 'Patient ID',
    id: who.displayId,
    bloodGroup: who.bloodGroup,
    rhFactor: who.rhFactor,
    keys: assessment.patientKeys,
  };
  const trail: ResumeTrail = {
    assessmentId,
    status: assessment.incident.status,
    interventionsId: interventions?.id ?? null,
    handoverId: handover?.id ?? null,
  };
  if (evacuation) {
    return { trail, step: 'EvacuationCompleted', patient, assessmentId };
  }
  if (handover) {
    return {
      trail,
      step: 'PrepareEvacuation',
      patient,
      assessmentId,
      handoverId: handover.id,
    };
  }
  if (interventions) {
    return {
      trail,
      step: 'Handover',
      patient,
      assessmentId,
      interventionsId: interventions.id,
    };
  }
  return {
    trail,
    step: 'Interventions',
    patient,
    assessment: { id: assessmentId, status: assessment.incident.status },
  };
}
