import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Jeevan Admin",
    template: "%s · Jeevan Admin",
  },
  description: "Jeevan — Digital Casualty Evacuation Program — personnel and QR identity administration (demo).",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
