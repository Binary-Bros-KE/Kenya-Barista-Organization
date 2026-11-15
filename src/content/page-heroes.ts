// Banner photo and breadcrumb for each inner landing page.
// To give a page its own photo, add it under public/ and set `image` on that route, e.g. image: "/page-heroes/team.jpg".
// Routes without an `image` use defaultHeroImage.
export const defaultHeroImage = "/legacy/90faddb4a4d62ac1.jpg";
type PageHero = { label: string; section?: string; image?: string };
export const pageHeroes: Record<string, PageHero> = {
 "/philosophy": { label: "Our philosophy", section: "About us" },
 "/team": { label: "Meet the team", section: "About us" },
 "/gallery": { label: "Gallery", section: "About us" },
 "/registration": { label: "Courses & registration", section: "Education" },
 "/education/online-courses": { label: "Online courses", section: "Education" },
 "/education/academies": { label: "Barista academies", section: "Education" },
 "/education/coaching": { label: "Coaching", section: "Education" },
 "/farming": { label: "Coffee farming", section: "Barista hub" },
 "/origin-and-processes": { label: "Origin and processes", section: "Barista hub" },
 "/bean": { label: "From bean to cup", section: "Barista hub" },
 "/barista-tools": { label: "Barista tools", section: "Barista hub" },
 "/jobs": { label: "Jobs", image: "/legacy/484b5cd378beff4a.jpg" },
 "/contact": { label: "Contact" },
};
