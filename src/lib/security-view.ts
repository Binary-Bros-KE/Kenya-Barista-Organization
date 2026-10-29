export type AuthenticatorEnrolment = { secret: string; backupCodes: string[] };
export function parseAuthenticatorEnrolment(input: unknown): AuthenticatorEnrolment {
 if (!input || typeof input !== "object") throw new Error("Setup could not be loaded. Try again.");
 const data = input as Record<string, unknown>;
 if (typeof data.totpURI !== "string" || !Array.isArray(data.backupCodes) || !data.backupCodes.length || data.backupCodes.some(code => typeof code !== "string" || !code.trim())) throw new Error("Setup could not be loaded. Try again.");
 let uri: URL; try { uri = new URL(data.totpURI); } catch { throw new Error("Setup could not be loaded. Try again."); }
 const secret = uri.searchParams.get("secret");
 if (uri.protocol !== "otpauth:" || uri.hostname !== "totp" || !secret || !/^[A-Z2-7]+=*$/i.test(secret)) throw new Error("Setup could not be loaded. Try again.");
 return { secret, backupCodes: data.backupCodes as string[] };
}
