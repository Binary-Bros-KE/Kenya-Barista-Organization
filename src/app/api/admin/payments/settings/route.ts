import { api, jsonInput } from "@/lib/api";
import { getDb } from "@/lib/db";
import { listMpesaSettings, saveMpesaSettings } from "@/server/mpesa-settings";
export async function GET(request:Request){return api(request,actor=>listMpesaSettings(getDb(),actor),true);}
export async function POST(request:Request){return api(request,async actor=>saveMpesaSettings(getDb(),actor,await jsonInput(request)),true);}

