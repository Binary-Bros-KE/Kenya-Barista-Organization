
/** Only job-application destinations are accepted from an untrusted URL. */
export function applicationReturnPath(value:string|null|undefined):string {return value&&/^\/jobs\/[a-zA-Z0-9_-]{1,160}\/apply$/.test(value)?value:"/dashboard";}
export function authDestination(route:string,next:string):string {const safe=applicationReturnPath(next);return safe==="/dashboard"?route:route+(route.includes("?")?"&":"?")+"next="+encodeURIComponent(safe);}
