import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">AI-Assisted Third-Party Risk Assessment</h1>
      <p className="max-w-2xl text-stone-700">
        A workflow and governance prototype: the AI suggests, the analyst decides, and code calculates every rating,
        tier and recommendation. The three workflow screens arrive in the next pull requests.
      </p>
      <p>
        <Link href="/rules" className="text-sky-700 underline underline-offset-2">
          See the deterministic rules and the v1 back-test
        </Link>
      </p>
    </div>
  );
}
