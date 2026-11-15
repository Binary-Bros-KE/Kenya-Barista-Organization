// Education pages copy. Dates, venues and fees are confirmed by KBO on enquiry, so none are stated here.
export type EducationSlug = "online-courses" | "academies" | "coaching";
export type Education = {
 metaTitle: string; title: string; eyebrow: string; intro: string;
 lead: { eyebrow: string; heading: string; text: string; listLabel: string; list: string[] };
 photo: { src: string; alt: string; width: number; height: number; caption: string };
 options: { heading: string; text: string; items: [string, string, string][] };
 steps: [string, string][];
 enquiry: { heading: string; extra?: [string, string] };
};
export const education: Record<EducationSlug, Education> = {
 "online-courses": {
  metaTitle: "Online Coffee Courses", title: "Learn coffee from wherever you are.", eyebrow: "EDUCATION · ONLINE COURSES",
  intro: "Self-paced lessons that build the knowledge behind the craft, from the farm to the cup, so your time on the bar is spent practising, not guessing.",
  lead: { eyebrow: "LEARN AT YOUR OWN PACE", heading: "Theory you can take anywhere.", text: "Short video lessons, guides and quick quizzes you can follow on your phone or laptop. They pair perfectly with hands-on academy training, or help you refresh what you already know.", listLabel: "What you will learn", list: ["Coffee origins: Kenyan regions, varieties and processing", "Brewing fundamentals: ratios, grind size and extraction", "Espresso theory: dose, yield, time and dialling in", "Milk science and the theory behind latte art", "Cafe hygiene, food safety and equipment care", "Running a coffee bar: costing, waste and customer service"] },
  photo: { src: "/legacy/e97f3bd070b2e630.jpg", alt: "A collection of latte art designs in coffee cups", width: 720, height: 900, caption: "Learn the why behind every cup." },
  options: { heading: "Choose how you learn.", text: "Every learner is different. Pick the format that fits your time, your budget and how you like to learn.", items: [["SELF-PACED", "Learn on your schedule", "Work through the lessons in your own time and come back to them whenever you need a refresher."], ["GUIDED GROUP", "Learn with a cohort", "Follow the course alongside other learners, with live online sessions to ask questions and share progress."], ["BLENDED", "Online plus a practical day", "Cover the theory online, then put it into practice in a hands-on session behind a real bar."]] },
  steps: [["Enquire", "Tell KBO which course and format interest you."], ["Get set up", "KBO confirms availability, fees and how to access your lessons."], ["Learn and practise", "Complete the lessons, then build on them with academy training or coaching."]],
  enquiry: { heading: "Start learning online." },
 },
 academies: {
  metaTitle: "Barista Academies", title: "Train behind a real bar.", eyebrow: "EDUCATION · BARISTA ACADEMIES",
  intro: "Hands-on, in-person training where you learn by doing: grinding, pulling shots, steaming milk and serving, with a trainer beside you.",
  lead: { eyebrow: "LEARN BY DOING", heading: "Skills you build with your hands.", text: "Academy training takes place in a working training space with professional espresso machines, grinders and brewing equipment. Small groups mean more time on the machine and more feedback from your trainer.", listLabel: "What you will practise", list: ["Espresso extraction and dialling in a grinder", "Milk steaming, texturing and latte art", "Filter brewing: V60, Kalita, AeroPress and plunger", "Cupping and tasting to build your palate", "Workflow, speed and service during a rush", "Hygiene, cleaning routines and machine care"] },
  photo: { src: "/legacy/f3b4f1ed24a04e1b.jpg", alt: "Trainees preparing coffee together at a training bench", width: 5568, height: 3712, caption: "Every trainee on the machine." },
  options: { heading: "Find your level.", text: "Start where you are. Each level builds on the one before, so you can keep growing as a barista.", items: [["LEVEL 1", "Foundation", "For complete beginners: the coffee journey, espresso basics, milk steaming and your first drinks."], ["LEVEL 2", "Intermediate", "For working baristas: consistency, dialling in, latte art patterns and speed on the bar."], ["LEVEL 3", "Advanced", "For experienced baristas: sensory skills, recipe design, training others and competition basics."]] },
  steps: [["Choose your level", "Not sure where to start? KBO can help you pick the right level."], ["Book your place", "Confirm dates, venue and fees with KBO before you commit."], ["Train and get feedback", "Finish with a practical session where your trainer reviews your skills and suggests next steps."]],
  enquiry: { heading: "Book your academy place.", extra: ["Run a training space? Partner with KBO", "/contact"] },
 },
 coaching: {
  metaTitle: "Barista Coaching", title: "Coaching for your next level.", eyebrow: "EDUCATION · COACHING",
  intro: "One-on-one and small-group coaching for baristas, competitors and coffee businesses, focused on you and your goals.",
  lead: { eyebrow: "PERSONAL. PRACTICAL. FOCUSED.", heading: "A coach in your corner.", text: "Coaching starts with where you are and where you want to be. Whether you are preparing for a competition, aiming for a promotion or training a new team, a coach helps you practise with purpose and see progress faster.", listLabel: "What coaching can focus on", list: ["Competition preparation: barista and latte art routines", "Sensory calibration and cupping skills", "Career coaching: CVs, interviews and trial shifts", "Consistency and speed for busy service", "Team training and workflow for cafes and hotels", "Menu, recipe and equipment advice for new coffee bars"] },
  photo: { src: "/legacy/232e14b81ed5d287.jpg", alt: "A trainer working with a barista at the coffee bar", width: 5568, height: 3712, caption: "Practise with purpose." },
  options: { heading: "Coaching that fits.", text: "From a single focused session to ongoing support for a whole team.", items: [["ONE-ON-ONE", "Personal coaching", "Sessions built around your goals, at a pace that suits you."], ["SMALL GROUP", "Group coaching", "Learn alongside a few others: ideal for colleagues, friends or competition teams."], ["ON-SITE", "For coffee businesses", "Coaching for your team at your own cafe, hotel or restaurant, on your own equipment."]] },
  steps: [["Talk to us", "Share your goals and what you would like to improve."], ["Make a plan", "Your coach reviews your skills and agrees on a focus with you."], ["Practise and review", "Coaching sessions with clear feedback and checkpoints along the way."]],
  enquiry: { heading: "Find your coach.", extra: ["Looking for work? Browse coffee jobs", "/jobs"] },
 },
};
