"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto max-w-xl px-6 py-24"><h1 className="text-3xl font-semibold">Something went wrong</h1><p className="mt-4">Please try again in a moment.</p><button className="mt-6 rounded bg-emerald-900 px-5 py-3 text-white" onClick={reset}>Try again</button></main>;
}
