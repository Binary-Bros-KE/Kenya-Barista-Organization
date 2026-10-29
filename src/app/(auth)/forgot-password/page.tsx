import { AuthForm } from "@/components/auth-form";
export default function Page() { return <><h1>Reset your password</h1><p className="intro">We’ll email you a link to choose a new password.</p><AuthForm mode="forgot-password" /></>; }
