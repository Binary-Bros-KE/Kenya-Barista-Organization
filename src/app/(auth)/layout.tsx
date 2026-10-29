import { LegacyShell } from "@/components/legacy-shell";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <LegacyShell compact><main className="legacy-auth-content"><div className="legacy-auth-form">{children}</div></main></LegacyShell>;
}
