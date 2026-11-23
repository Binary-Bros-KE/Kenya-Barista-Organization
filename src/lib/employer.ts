// Jobs posted by a KBO administrator are shown as the organisation itself, always verified.
export const KBO_EMPLOYER_NAME = "Kenya Barista Organization";
export function asEmployer<T extends { name: string | null; role?: string; recruiterVerifiedAt: Date | string | null }>(owner: T): T {
  return owner.role === "ADMIN" ? { ...owner, name: KBO_EMPLOYER_NAME, recruiterVerifiedAt: owner.recruiterVerifiedAt ?? new Date(0) } : owner;
}
