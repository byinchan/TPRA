import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const README_URL = "https://github.com/byinchan/TPRA#readme";

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
        <footer className="mx-auto max-w-6xl border-t border-stone-200 px-4 py-6 text-xs text-stone-500 print:hidden">
          <p>
            Fictional organization and vendor · Prototype, not a commercial TPRM platform · AI-assisted, human-reviewed ·{" "}
            <a href={README_URL} target="_blank" rel="noreferrer" className="underline">
              How it works →
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
