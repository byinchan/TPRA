import type { Metadata } from "next";
import { FindingsScreen } from "@/components/FindingsScreen.tsx";

export const metadata: Metadata = { title: "Findings & report · TPRA" };

export default function ReportPage() {
  return <FindingsScreen />;
}
