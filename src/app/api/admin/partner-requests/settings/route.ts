import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveNotificationEmail } from "@/server/partner-requests";
// The address admin alerts (such as new partner requests) are emailed to.
export function PUT(request: Request) { return api(request, async actor => saveNotificationEmail(getDb(), actor, await jsonInput(request)), true); }
