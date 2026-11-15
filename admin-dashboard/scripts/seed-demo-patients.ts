/**
 * DEMO ONLY: adds fictional patients (soldiers) and clinical staff for client
 * demonstrations, through the normal services — every soldier gets a signed
 * QR credential, exactly as if registered in the dashboard.
 *
 *   npm run demo:patients        # then: npm run mobile:provision
 *
 * Safe to run more than once: records whose service number already exists
 * are skipped. Works on a store that already has other records (unlike the
 * Settings → "Load sample data" button, which needs an empty store).
 *
 * The tablet's client-demo account (MED-DEMO-02) builds its sample
 * evacuations on these patients, matched by full name — keep the names in
 * step with CasevacMobile/src/data/sampleCasualties.ts.
 */
import { getRepository } from "../src/lib/data";
import type { Actor } from "../src/lib/domain/types";
import { registerSoldier, registerStaff } from "../src/lib/services/personnel-service";

const actor: Actor = { id: "CLI-DEMO-PATIENTS", name: "Demo patients script" };

const SOLDIERS = [
  { fullName: "Vikram Singh", serviceNumber: "DEMO-P-4001", rank: "Sepoy", unit: "Alpha", dateOfBirth: "1999-03-14", sex: "MALE", bloodGroup: "B", rhFactor: "POSITIVE", medicalCategory: "SHAPE 1", identificationMarks: "Mole on left cheek", nextOfKinName: "Kamla Devi", nextOfKinRelationship: "Mother", nextOfKinPhone: "+91 98100 40011", contactPhone: "+91 98100 40001" },
  { fullName: "Rohit Yadav", serviceNumber: "DEMO-P-4002", rank: "Naik", unit: "Bravo", dateOfBirth: "1995-07-22", sex: "MALE", bloodGroup: "O", rhFactor: "POSITIVE", medicalCategory: "SHAPE 1", identificationMarks: "Scar on right forearm", nextOfKinName: "Pooja Yadav", nextOfKinRelationship: "Wife", nextOfKinPhone: "+91 98100 40012", contactPhone: "+91 98100 40002" },
  { fullName: "Sunita Rawat", serviceNumber: "DEMO-P-4003", rank: "Lance Naik", unit: "Charlie", dateOfBirth: "1997-11-05", sex: "FEMALE", bloodGroup: "A", rhFactor: "NEGATIVE", medicalCategory: "SHAPE 1", identificationMarks: "", nextOfKinName: "Harish Rawat", nextOfKinRelationship: "Father", nextOfKinPhone: "+91 98100 40013", contactPhone: "+91 98100 40003" },
  { fullName: "Manpreet Gill", serviceNumber: "DEMO-P-4004", rank: "Havildar", unit: "Delta", dateOfBirth: "1988-01-30", sex: "MALE", bloodGroup: "AB", rhFactor: "POSITIVE", medicalCategory: "SHAPE 1", identificationMarks: "Tattoo on left shoulder", nextOfKinName: "Jasleen Kaur", nextOfKinRelationship: "Wife", nextOfKinPhone: "+91 98100 40014", contactPhone: "+91 98100 40004" },
  { fullName: "Imran Khan", serviceNumber: "DEMO-P-4005", rank: "Sepoy", unit: "Echo", dateOfBirth: "2000-09-18", sex: "MALE", bloodGroup: "B", rhFactor: "NEGATIVE", medicalCategory: "SHAPE 1", identificationMarks: "", nextOfKinName: "Shabana Khan", nextOfKinRelationship: "Mother", nextOfKinPhone: "+91 98100 40015", contactPhone: "+91 98100 40005" },
  { fullName: "Deepak Thapa", serviceNumber: "DEMO-P-4006", rank: "Rifleman", unit: "Foxtrot", dateOfBirth: "1998-04-09", sex: "MALE", bloodGroup: "O", rhFactor: "NEGATIVE", medicalCategory: "SHAPE 1", identificationMarks: "Burn mark on right hand", nextOfKinName: "Maya Thapa", nextOfKinRelationship: "Mother", nextOfKinPhone: "+91 98100 40016", contactPhone: "+91 98100 40006" },
];

/** Clinicians a casualty can be handed over to on the tablet. */
const STAFF = [
  { fullName: "Neha Kapoor", serviceNumber: "DEMO-D-5001", rank: "Major", unit: "Forward Surgical Centre", role: "MEDICAL_OFFICER", designation: "Surgeon, FSC", dateOfBirth: "1986-06-12", contactPhone: "+91 98100 50001" },
  { fullName: "Aditya Rao", serviceNumber: "DEMO-D-5002", rank: "Captain", unit: "Advanced Dressing Station", role: "MEDICAL_OFFICER", designation: "Medical Officer, ADS", dateOfBirth: "1992-02-03", contactPhone: "+91 98100 50002" },
  { fullName: "Suresh Patil", serviceNumber: "DEMO-M-5003", rank: "Havildar", unit: "Regimental Aid Post", role: "MEDIC", designation: "Nursing Assistant", dateOfBirth: "1990-10-21", contactPhone: "+91 98100 50003" },
];

async function main() {
  const repo = getRepository();
  if (repo.kind !== "demo-file") {
    console.error("Demo patients can only be added to the demo data store.");
    process.exit(1);
  }

  let added = 0;
  let skipped = 0;
  for (const s of SOLDIERS) {
    if (await repo.findPersonByServiceNumber(s.serviceNumber)) {
      skipped += 1;
      continue;
    }
    const r = await registerSoldier({ ...s, status: "ACTIVE" }, actor);
    if (!r.ok) throw new Error(`Soldier ${s.fullName}: ${r.message} ${JSON.stringify(r.fieldErrors ?? {})}`);
    console.log(`  + ${r.value.person.displayId}  ${s.rank} ${s.fullName} (${s.unit}) — QR issued`);
    added += 1;
  }
  for (const s of STAFF) {
    if (await repo.findPersonByServiceNumber(s.serviceNumber)) {
      skipped += 1;
      continue;
    }
    const r = await registerStaff({ ...s, status: "ACTIVE" }, actor);
    if (!r.ok) throw new Error(`Staff ${s.fullName}: ${r.message} ${JSON.stringify(r.fieldErrors ?? {})}`);
    console.log(`  + ${r.value.displayId}  ${s.rank} ${s.fullName} (${s.designation})`);
    added += 1;
  }

  console.log(`Demo patients: ${added} added, ${skipped} already present.`);
  console.log("Next: `npm run mobile:provision`, then reload the tablet app.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
