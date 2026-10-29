import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto max-w-xl px-6 py-24"><p className="text-sm text-stone-500">404</p><h1 className="mt-3 text-3xl font-semibold">Page not found</h1><Link href="/" className="mt-6 inline-block underline">Return home</Link></main>;
}
