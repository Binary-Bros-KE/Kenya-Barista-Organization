import Link from "next/link";
import { applicationStatusLabels } from "@/lib/application-format";
import { formatDeadline } from "@/lib/job-format";
type Result={responses:{id:string;source:string;senderLabel:string;body:string;status:keyof typeof applicationStatusLabels;createdAt:Date}[];pagination:{page:number;total:number;pageCount:number}};
export function ApplicationResponses({result}:{result:Result}){
 return <section className="mt-8"><h2>Responses and updates</h2><p className="hint mb-5">Messages and status updates are shown here as soon as they are saved.</p><div className="grid gap-4">{result.responses.map(response=><article className="card" key={response.id}><div className="flex flex-wrap justify-between gap-3"><strong>{response.senderLabel}</strong><span className="badge">{applicationStatusLabels[response.status]}</span></div><p className="hint mt-2">{formatDeadline(response.createdAt)}</p><p className="mt-4 whitespace-pre-wrap break-words">{response.body}</p></article>)}{!result.responses.length&&<p>No responses yet. Check back for updates.</p>}</div><nav className="mt-5 flex gap-5" aria-label="Response pages">{result.pagination.page>1&&<Link href={"?responsePage="+(result.pagination.page-1)}>Newer responses</Link>}{result.pagination.page<result.pagination.pageCount&&<Link href={"?responsePage="+(result.pagination.page+1)}>Older responses</Link>}</nav></section>;
}

