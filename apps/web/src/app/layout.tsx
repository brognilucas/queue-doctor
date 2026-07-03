import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-loaded",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-loaded",
});

export const metadata: Metadata = {
  title: "QueueDoctor — Serverless production readiness report",
  description:
    "Paste a serverless config and get a production readiness report for Lambda DLQs, retries, timeouts, and observability. Free Lambda DLQ checklist — runs in your browser.",
  keywords: [
    "serverless production readiness",
    "Lambda DLQ checklist",
    "SQS redrive policy",
    "serverless.yml review",
    "SAM production checklist",
  ],
  openGraph: {
    title: "QueueDoctor — Serverless production readiness report",
    description:
      "Paste serverless.yml or SAM and get pass/warn/fail findings for failure handling, retries, and observability.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
