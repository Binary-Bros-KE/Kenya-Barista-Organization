import { AuthForm } from "@/components/auth-form";
export default function Page() { return <><h1>One more step</h1><p className="intro">Enter the code from your authenticator app to finish signing in.</p><AuthForm mode="two-factor" /></>; }
