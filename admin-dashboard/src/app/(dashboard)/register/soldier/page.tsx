import type { Metadata } from "next";
import { registerSoldierAction } from "@/app/actions/personnel-actions";
import { SoldierForm } from "@/components/forms/soldier-form";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Panel } from "@/components/ui/layout";

export const metadata: Metadata = { title: "Register soldier" };

export default function RegisterSoldierPage() {
  return (
    <>
      <PageHeader
        eyebrow="Personnel / Register"
        title="Register soldier"
        description="Creates a permanent patient identity and issues a QR wristband token. Fields marked * are required."
      />
      <div className="flex flex-wrap items-start gap-6">
        <div className="min-w-0 flex-[999_1_560px]">
          <SoldierForm action={registerSoldierAction} mode="create" cancelHref="/personnel" />
        </div>
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <Panel title="Identification method" bodyClassName="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3 rounded-md border-[1.5px] border-brand p-3">
              <input type="radio" id="method-qr" name="method-display" checked readOnly className="mt-1" />
              <label htmlFor="method-qr" className="flex flex-col gap-0.5 text-sm">
                <span className="font-semibold">QR wristband</span>
                <span className="text-xs text-muted">Digitally signed credential; printable label</span>
              </label>
            </div>
            <div className="flex items-start gap-3 rounded-md border border-line bg-canvas p-3 text-muted">
              <input type="radio" id="method-nfc" name="method-display" disabled className="mt-1" />
              <label htmlFor="method-nfc" className="flex flex-col gap-0.5 text-sm">
                <span className="flex items-center gap-2 font-semibold">
                  RFID / NFC wristband <Badge>Unavailable</Badge>
                </span>
                <span className="text-xs">Future hardware phase; will attach to the same patient identity.</span>
              </label>
            </div>
          </Panel>
          <Panel title="What happens on save" bodyClassName="p-4">
            <ol className="flex list-decimal flex-col gap-2 pl-5 text-[13px] leading-5 text-ink-2">
              <li>Service number is checked for duplicates.</li>
              <li>
                The next display ID is assigned (e.g. <span className="font-mono">PAT-00001</span>) plus a random internal ID.
              </li>
              <li>
                A credential is issued and signed with the dashboard&apos;s Ed25519 issuer key. The QR holds only
                credential and patient IDs, an issue time and the signature — no name, service number or medical data.
              </li>
              <li>The QR is shown on the profile for printing or download.</li>
            </ol>
          </Panel>
        </aside>
      </div>
    </>
  );
}
