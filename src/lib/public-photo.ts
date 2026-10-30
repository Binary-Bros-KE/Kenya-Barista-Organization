
import manifest from "@/content/optimized-photos.json";
export function publicPhoto(src:string,size:"large"|"small"="large"):string {return (manifest as Record<string,{large:string;small:string}>)[src]?.[size]||src;}
/** Only reviewed archive HTML is accepted; leave all text and original content untouched. */
export function publicArticleHtml(html:string):string {return html.replace(/(<img\b[^>]*\bsrc=")(\/legacy\/[^"\s]+)(")/g,(_match,before:string,src:string,after:string)=>before+publicPhoto(src)+after);}
