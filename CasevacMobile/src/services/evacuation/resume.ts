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

export type ResumeStep =
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
    };

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
  if (evacuation) {
    return { step: 'EvacuationCompleted', patient, assessmentId };
  }
  if (handover) {
    return {
      step: 'PrepareEvacuation',
      patient,
      assessmentId,
      handoverId: handover.id,
    };
  }
  if (interventions) {
    return {
      step: 'Handover',
      patient,
      assessmentId,
      interventionsId: interventions.id,
    };
  }
  return {
    step: 'Interventions',
    patient,
    assessment: { id: assessmentId, status: assessment.incident.status },
  };
}
