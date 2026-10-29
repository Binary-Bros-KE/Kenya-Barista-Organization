import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { saveProfile } from "@/server/applications";
export async function PUT(request: Request) { return api(request, async actor => saveProfile(getDb(), actor, await jsonInput(request))); }

