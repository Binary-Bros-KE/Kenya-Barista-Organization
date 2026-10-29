export const categories = { BARISTA: "Barista", ROASTING: "Roasting & production", HOSPITALITY: "Hospitality", TRAINING: "Training & education", MANAGEMENT: "Management", OTHER: "Other coffee careers" } as const;
export const employmentTypes = { FULL_TIME: "Full time", PART_TIME: "Part time", CONTRACT: "Contract", INTERNSHIP: "Internship", TEMPORARY: "Temporary" } as const;
export const statusLabels = { DRAFT: "Draft", PENDING_REVIEW: "Awaiting review", CHANGES_REQUESTED: "Changes requested", PUBLISHED: "Published", CLOSED: "Closed", ARCHIVED: "Archived" } as const;
export function formatFee(minor: number) { return new Intl.NumberFormat("en-KE", { style: "currency", currency: "KES", maximumFractionDigits: 0 }).format(minor / 100); }
export function formatDeadline(value: string | Date) { return new Intl.DateTimeFormat("en-KE", { timeZone: "Africa/Nairobi", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
export function nairobiInput(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Nairobi", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const field = (name: string) => parts.find(part => part.type === name)?.value;
  return `${field("year")}-${field("month")}-${field("day")}T${field("hour")}:${field("minute")}`;
}
export function nairobiToIso(value: string) { return new Date(`${value}:00+03:00`).toISOString(); }
