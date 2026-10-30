
import type {KeyboardEvent} from "react";
/** Keep keyboard traversal inside an open modal, including its first/last controls. */
export function trapDialogFocus(event:KeyboardEvent<HTMLDialogElement>){
 if(event.key!=="Tab")return;
 const dialog=event.currentTarget;
 const controls=[...dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter(element=>element.tabIndex>=0&&element.getClientRects().length>0&&!element.closest('[inert]'));
 const first=controls[0],last=controls.at(-1);
 if(!first){event.preventDefault();dialog.focus();return;}
 if(event.shiftKey&&(document.activeElement===first||!dialog.contains(document.activeElement))){event.preventDefault();last?.focus();}
 else if(!event.shiftKey&&(document.activeElement===last||!dialog.contains(document.activeElement))){event.preventDefault();first.focus();}
}
