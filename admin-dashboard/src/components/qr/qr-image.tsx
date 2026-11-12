import { renderQrSvg } from "@/lib/services/identity-service";

/**
 * Server-rendered QR (SVG). The markup comes from the qrcode library and
 * encodes only the opaque payload, so inlining it is safe.
 */
export async function QrImage({ payload, label, size = 200 }: { payload: string; label: string; size?: number }) {
  const svg = await renderQrSvg(payload);
  return (
    <div
      role="img"
      aria-label={label}
      style={{ width: size, height: size }}
      className="[&>svg]:h-full [&>svg]:w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
