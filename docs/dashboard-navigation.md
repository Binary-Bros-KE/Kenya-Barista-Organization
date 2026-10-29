# Dashboard sidebar

The shared Workspace component supplies coffee-toned navigation to account, employer and administrator pages. Existing page content, routes and access checks remain in their existing server components.

- Desktop (1024px and wider): 272px sidebar, collapsible to an 84px icon rail. The preference is stored in browser localStorage; blocked storage does not prevent use.
- Mobile/tablet: native modal dialog drawer with focus containment, Escape/backdrop/close-button dismissal, background scroll lock and focus restoration. Selecting a link or resizing to desktop closes the drawer.
- Navigation groups preserve account, employer, administrator and public job links. Administrator links still depend on the server-provided admin flag. Active states match nested pages without making overview links active everywhere.
- Labels remain available to assistive technology in icon mode. Buttons have accessible names, touch targets and focus outlines; reduced-motion preferences disable sidebar transitions.
- The existing logo, a sticky contextual top bar, user initials and coffee colors replace the text wordmark and wrapped link row. Styles are scoped to workspace classes; public/auth page branding is unaffected.

No new dependencies or database changes. This phase changes navigation/layout, not the dashboard tab contents. Browser visual/interaction acceptance remains necessary when browser tooling is unavailable.
