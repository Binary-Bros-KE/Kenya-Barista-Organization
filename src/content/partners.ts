// Partners shown on the home page. Descriptions are placeholder copy: confirm the wording with each
// partner before launch. Add a logo (a file in /public, used with the partner's permission) and a
// website when they're agreed; until then the card shows the partner's initials.
export type Partner = { name: string; initials: string; role: string; description: string; logo?: string; website?: string };

export const partners: Partner[] = [
  { name: "Kenya Barista Organization", initials: "KBO", role: "Host organisation", logo: "/brand-logo.png",
    description: "Brings baristas, trainers and employers together through training, community events and coffee careers." },
  { name: "Arobisca Group", initials: "AG", role: "Coffee industry partner",
    description: "A Kenyan coffee company supporting the craft from bean to cup, and the people who serve it." },
  { name: "Arobisca Training Centre", initials: "ATC", role: "Training partner",
    description: "Hands-on barista and coffee training that prepares learners for work behind the bar." },
  { name: "Brookside Kenya", initials: "BK", role: "Dairy partner",
    description: "Supporting the espresso bar with milk for everything from flat whites to latte art practice." },
];
