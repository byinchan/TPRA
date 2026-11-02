import type { Metadata } from "next";
import { ReviewScreen } from "@/components/ReviewScreen.tsx";

export const metadata: Metadata = { title: "Due diligence review · TPRA" };

export default function ReviewPage() {
  return <ReviewScreen />;
}
