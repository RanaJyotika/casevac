/**
 * Receiving side: stores a verified package on this tablet so the next team
 * can continue care.
 *
 *   - every record of the evacuation, with its original IDs (read only — it
 *     belongs to the medic who recorded it)
 *   - the patient's history entries from the sending tablet
 *   - a "Received from …" entry in the patient's history
 *   - a field-registered (TEMP-) casualty, so this tablet knows them too
 * Importing the same transfer again changes nothing (transfer log).
 * Returns the receipt the sending tablet needs as proof of delivery.
 */
import { getAssessmentStore } from '../evacuation/assessment';
import { getEvacuationStore } from '../evacuation/evacuation';
import { getHandoverStore } from '../evacuation/handover';
import { getInterventionsStore } from '../evacuation/interventions';
import type { TransferKey } from '../identity/provisioningStore';
import { getFieldRegistry } from '../patients/fieldRegistry';
import { getPatientHistoryStore } from '../patients/historyStore';
import type { Clinician } from '../../types';
import { receiptCode, type Receipt } from './receipt';
import {
  summarise,
  type PackageSources,
  type TransferPackage,
  type TransferSummary,
} from './transferPackage';
import {
  getTransferLog,
  type TransferChannel,
  type TransferLog,
} from './transferLog';

export interface ImportResult {
  duplicate: boolean;
  summary: TransferSummary;
  receipt: Receipt;
  /** The imported evacuation (its assessment ID). */
  assessmentId: string;
}

export async function importTransfer(
  pkg: TransferPackage,
  receiver: Clinician,
  unitKey: TransferKey,
  channel: TransferChannel,
  sources: PackageSources & { log?: TransferLog } = {},
): Promise<ImportResult> {
  const log = sources.log ?? getTransferLog();
  const summary = summarise(pkg);
  const e = pkg.evacuation;
  const receipt: Receipt = {
    transferId: pkg.transferId,
    receiverId: receiver.id.toUpperCase(),
    code: receiptCode(unitKey, pkg.transferId, receiver.id),
  };
  const result = {
    summary,
    receipt,
    assessmentId: e.assessment.id,
  };
  if (await log.wasReceived(pkg.transferId)) {
    return { ...result, duplicate: true };
  }

  await (sources.assessments ?? getAssessmentStore()).importRecords([
    e.assessment,
  ]);
  if (e.interventions) {
    await (sources.interventions ?? getInterventionsStore()).importRecords([
      e.interventions,
    ]);
  }
  if (e.handover) {
    await (sources.handovers ?? getHandoverStore()).importRecords([
      e.handover,
    ]);
  }
  if (e.evacuation) {
    await (sources.evacuations ?? getEvacuationStore()).importRecords([
      e.evacuation,
    ]);
  }

  const history = sources.history ?? getPatientHistoryStore();
  for (const entry of pkg.history) {
    if (!(await history.get(entry.id))) {
      await history.upsert(entry);
    }
  }
  const p = pkg.patient;
  const from = [pkg.sender.rank, pkg.sender.name].filter(Boolean).join(' ');
  await history.upsert({
    id: `RCV-${pkg.transferId}`,
    patientKeys: p.keys,
    at: new Date().toISOString(),
    title: `Received from ${from || pkg.sender.id} (${pkg.sender.id})`,
    detail: [
      channel === 'QR' ? 'By QR transfer' : 'By Bluetooth transfer',
      summary.handedOver ? 'evacuation handed over' : 'evacuation in progress',
      summary.triage ?? '',
    ]
      .filter(Boolean)
      .join(' · '),
    recordedBy: receiver.id,
  });

  if (p.temporary) {
    await (sources.fieldRegistry ?? getFieldRegistry()).importPatient({
      tempId: p.displayId,
      fullName: p.name,
      rank: p.rank,
      age: p.age,
      sex: p.sex,
      bloodGroup: p.bloodGroup,
      rhFactor: p.rhFactor,
      unit: p.unit,
      registeredAt: e.assessment.recordedAt,
      registeredBy: pkg.sender.id,
      link: {},
    });
  }

  await log.recordReceived({
    transferId: pkg.transferId,
    assessmentId: e.assessment.id,
    patientLabel: summary.patientLabel,
    channel,
    senderId: pkg.sender.id,
    senderName: from,
    receivedAt: new Date().toISOString(),
    receivedBy: receiver.id,
  });
  return { ...result, duplicate: false };
}
