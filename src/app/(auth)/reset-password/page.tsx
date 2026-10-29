import { AuthForm } from "@/components/auth-form";
export default function Page() { return <><h1>Choose a new password</h1><p className="intro">Use a unique passphrase you haven’t used elsewhere.</p><AuthForm mode="reset-password" /></>; }
