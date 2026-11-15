import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

// The dashboard's signature button: gradient, dot texture and a faded copy of its icon, matching the stat cards.
// Tones and styles live in signature.css. Pass `href` for a link, otherwise it renders a <button>.
export type SignatureTone = "teal" | "rose" | "gold" | "green";
type Props = { tone?: SignatureTone; icon: ReactNode; children: ReactNode; href?: string; className?: string } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export function SignatureButton({ tone = "green", icon, children, href, className = "", type = "button", ...buttonProps }: Props) {
  const classes = `signature-button signature-${tone} ${className}`.trim();
  const content = <><span className="signature-icon">{icon}</span><span className="signature-label">{children}</span><span className="signature-mark" aria-hidden="true">{icon}</span></>;
  return href ? <Link href={href} className={classes}>{content}</Link> : <button type={type} className={classes} {...buttonProps}>{content}</button>;
}
