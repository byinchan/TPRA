import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "TPRA: AI-Assisted Third-Party Risk Assessment",
  description:
    "A workflow and governance prototype for third-party risk assessment at a fictional BC Crown corporation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-stone-50 text-stone-900 antialiased print:bg-white">
        <header className="border-b border-stone-200 bg-white print:hidden">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold">
              TPRA <span className="font-normal text-stone-500">· Pacific Utilities Corporation (fictional)</span>
            </Link>
            <Link href="/" className="text-stone-600 hover:text-stone-900">
              Assessment
            </Link>
            <Link href="/rules" className="text-stone-600 hover:text-stone-900">
              Rules
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">{children}</main>
        <footer className="mx-auto max-w-6xl space-y-1 border-t border-stone-200 px-4 py-6 text-xs text-stone-500 print:hidden">
          <p>
            This is a workflow and governance prototype, not a commercial TPRM platform or an enterprise-ready product.
          </p>
          <p>Fictional organization. AI-assisted, human-reviewed.</p>
        </footer>
      </body>
    </html>
  );
}
