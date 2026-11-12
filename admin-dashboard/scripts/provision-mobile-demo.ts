/**
 * DEMO PROVISIONING — writes the identity directory and the trusted issuer
 * public key into the mobile app source so a phone can verify and resolve
 * dashboard-issued QR codes fully offline.
 *
 *   npm run mobile:provision            # → ../CasevacMobile/src/provisioning
 *   npm run mobile:provision -- --out <dir>
 *
 * Then reload the app (Metro bundles the JSON). This stands in for the future
 * backend provisioning service (device enrolment + encrypted directory
 * download). Fictional records only: the output is committed with the app.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { getRepository } from "../src/lib/data";
import { ok, runTransaction } from "../src/lib/services/common";
import { buildIdentityDirectory, buildTrustedIssuerKeys } from "../src/lib/services/directory-service";

function writeJsonAtomic(file: string, value: unknown) {
  const temp = `${file}.tmp`;
  writeFileSync(temp, JSON.stringify(value, null, 2) + "\n", "utf8");
  renameSync(temp, file);
}

async function main() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const outDir = path.resolve(
    outIndex >= 0 && args[outIndex + 1] ? args[outIndex + 1] : path.join("..", "CasevacMobile", "src", "provisioning"),
  );

  const trusted = buildTrustedIssuerKeys();
  if (!trusted) {
    console.error("QR signing key is not configured. Run `npm run issuer:keygen` first.");
    process.exit(1);
  }
  const directory = await buildIdentityDirectory();
  const legacy = (await getRepository().listCredentials()).filter(c => c.status === "ACTIVE" && c.formatVersion !== 2);
  const otherKeys = directory.credentials.filter(c => c.status === "ACTIVE" && c.keyId !== trusted.keys[0].keyId);

  mkdirSync(outDir, { recursive: true });
  writeJsonAtomic(path.join(outDir, "trusted-issuer-keys.json"), trusted);
  writeJsonAtomic(path.join(outDir, "demo-identity-directory.json"), directory);

  await runTransaction({ id: "CLI-PROVISION", name: "Mobile provisioning script" }, async (_tx, audit) => {
    await audit(
      "DIRECTORY_EXPORTED",
      "SYSTEM",
      null,
      `Provisioned mobile demo directory (${directory.patients.length} patients, ${directory.credentials.length} credentials)`,
    );
    return ok(null);
  });

  console.log(`Wrote mobile provisioning files to ${outDir}`);
  console.log(`  Trusted issuer key: ${trusted.keys[0].keyId}`);
  console.log(`  Patients: ${directory.patients.length} · Signed credentials: ${directory.credentials.length}`);
  if (legacy.length > 0) {
    console.warn(`  WARNING: ${legacy.length} active QR code(s) are legacy unsigned v1 — reissue them in the dashboard.`);
  }
  if (otherKeys.length > 0) {
    console.warn(`  WARNING: ${otherKeys.length} active QR code(s) were signed by an older key the phone will not trust — reissue them.`);
  }
  console.log("Reload the mobile app to pick up the new files.");
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
