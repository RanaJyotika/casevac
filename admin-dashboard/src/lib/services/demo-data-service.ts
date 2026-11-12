/**
 * DEMO ONLY: load or erase clearly fictional sample records.
 * Sample records go through the normal services so every rule applies.
 */
import { getRepository } from "../data";
import type { Actor } from "../domain/types";
import { fail, ok, runTransaction, type ServiceResult } from "./common";
import { registerSoldier, registerStaff } from "./personnel-service";
import { createTeam } from "./team-service";

export async function seedDemoData(actor: Actor): Promise<ServiceResult<{ created: number }>> {
  const repo = getRepository();
  if (repo.kind !== "demo-file") return fail("Sample data can only be loaded into the demo data store.");
  if ((await repo.listPersons()).length > 0 || (await repo.listTeams()).length > 0) {
    return fail("Sample data can only be loaded into an empty demo store. Reset it first.");
  }

  const soldiers = [
    { fullName: "Rahul Sharma", serviceNumber: "DEMO-S-1001", rank: "Sepoy", unit: "2 Demo Rifles", bloodGroup: "B", rhFactor: "POSITIVE", sex: "MALE" },
    { fullName: "Arjun Mehta", serviceNumber: "DEMO-S-1002", rank: "Naik", unit: "2 Demo Rifles", bloodGroup: "O", rhFactor: "POSITIVE", sex: "MALE" },
    { fullName: "Priya Nair", serviceNumber: "DEMO-S-1003", rank: "Lance Naik", unit: "5 Demo Engineers", bloodGroup: "A", rhFactor: "NEGATIVE", sex: "FEMALE" },
  ];
  const staff = [
    { fullName: "Anita Verma", serviceNumber: "DEMO-M-2001", rank: "Naik", unit: "Demo Field Ambulance", role: "MEDIC" },
    { fullName: "Karan Rao", serviceNumber: "DEMO-M-2002", rank: "Sepoy", unit: "Demo Field Ambulance", role: "MEDIC" },
    { fullName: "Kavya Iyer", serviceNumber: "DEMO-D-3001", rank: "Major", unit: "Demo Military Hospital", role: "MEDICAL_OFFICER", designation: "Regimental Medical Officer" },
  ];

  let created = 0;
  for (const s of soldiers) {
    const r = await registerSoldier({ ...s, status: "ACTIVE" }, actor);
    if (!r.ok) return fail(`Sample soldier failed: ${r.message}`);
    created += 1;
  }
  const staffIds: string[] = [];
  for (const s of staff) {
    const r = await registerStaff({ ...s, status: "ACTIVE" }, actor);
    if (!r.ok) return fail(`Sample staff failed: ${r.message}`);
    staffIds.push(r.value.id);
    created += 1;
  }
  const team = await createTeam(
    { name: "Forward Evacuation Team A", unit: "Demo Field Ambulance", description: "Fictional demo team", leaderId: staffIds[0], status: "ACTIVE" },
    actor,
  );
  if (!team.ok) return fail(`Sample team failed: ${team.message}`);
  // Second medic joins the team; the doctor is left unassigned on purpose.
  await runTransaction(actor, async (tx, audit) => {
    const t = await tx.getTeam(team.value.id);
    if (!t) return fail("Team missing");
    await tx.updateTeam({ ...t, memberIds: [...t.memberIds, staffIds[1]] });
    await audit("DEMO_DATA_SEEDED", "SYSTEM", null, "Loaded fictional sample records");
    return ok(null);
  });
  return ok({ created: created + 1 });
}

export async function resetDemoData(actor: Actor): Promise<ServiceResult<null>> {
  const repo = getRepository();
  if (repo.kind !== "demo-file") return fail("Only the demo data store can be reset.");
  await repo.resetAll();
  return runTransaction(actor, async (_tx, audit) => {
    await audit("DEMO_DATA_RESET", "SYSTEM", null, "Erased all demo records");
    return ok(null);
  });
}
