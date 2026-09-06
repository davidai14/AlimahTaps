import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-neutral-100 p-6 text-center">
      <h1 className="text-2xl font-bold text-neutral-800">Not available for your role</h1>
      <p className="text-neutral-500">Ask a manager or the owner if you need access to this.</p>
      <Link href="/" className="text-amber-700 underline underline-offset-2">
        Back to home
      </Link>
    </div>
  );
}
