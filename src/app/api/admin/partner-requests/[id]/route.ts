import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { setPartnerRequestStatus } from "@/server/partner-requests";
// Move a request between New, Contacted and Archived.
export function PATCH(request: Request, context: { params: Promise<{ id: string }> }) { return api(request, async actor => setPartnerRequestStatus(getDb(), actor, (await context.params).id, await jsonInput(request)), true); }
