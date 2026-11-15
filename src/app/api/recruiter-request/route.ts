import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { myRecruiterRequest, submitRecruiterRequest, withdrawRecruiterRequest } from "@/server/recruiter-requests";
export const dynamic = "force-dynamic";
// The signed-in job seeker's own request to become a recruiter.
export function GET(request: Request) { return api(request, async actor => ({ request: await myRecruiterRequest(getDb(), actor) })); }
export function POST(request: Request) { return api(request, async actor => ({ request: await submitRecruiterRequest(getDb(), actor, await jsonInput(request)) })); }
export function DELETE(request: Request) { return api(request, actor => withdrawRecruiterRequest(getDb(), actor)); }
