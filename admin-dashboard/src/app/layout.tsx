import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CASEVAC Admin",
    template: "%s · CASEVAC Admin",
  },
  description: "CASEVAC Digital Evacuation Program — personnel and QR identity administration (demo).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
