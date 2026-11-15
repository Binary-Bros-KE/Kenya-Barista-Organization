import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { setAccountType } from "@/server/employers";
export const dynamic = "force-dynamic";
// Switch an account between job seeker and recruiter: { userId | email, role: "APPLICANT" | "RECRUITER" }.
export function POST(request: Request) { return api(request, async actor => setAccountType(getDb(), actor, await jsonInput(request)), true); }
