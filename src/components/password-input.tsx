"use client";
import { useState, type InputHTMLAttributes } from "react";

// Password field with a show/hide toggle. The input keeps its name, so forms read it as before.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  return <span className="password-field">
    <input {...props} type={visible ? "text" : "password"} autoCapitalize="none" autoCorrect="off" spellCheck={false} />
    <button type="button" className="password-toggle" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} title={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>
      <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{visible
        ? <><path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6 0 9.5 7 9.5 7a17 17 0 0 1-3.1 3.9M6.6 6.6C3.9 8.4 2.5 12 2.5 12S6 19 12 19a9.7 9.7 0 0 0 4.3-1" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" /></>
        : <><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7Z" /><circle cx="12" cy="12" r="3" /></>}</svg>
    </button>
  </span>;
}
