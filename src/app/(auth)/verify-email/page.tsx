import { AuthJourneyLink } from "@/components/auth-journey-link";
import { AuthForm } from "@/components/auth-form";
export default function Page() { return <><h1>Check your email</h1><p className="intro">Open the verification link we sent you before signing in. Check your spam folder if you can’t find it.</p><details><summary className="mb-6 cursor-pointer">Need another verification email?</summary><AuthForm mode="verify-email" /></details><AuthJourneyLink href="/sign-in" className="mt-6 inline-block underline">Continue to sign in</AuthJourneyLink></>; }
