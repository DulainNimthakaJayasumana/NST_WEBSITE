/* ============================================================
   data.js: seed content for NextGen Storytellers 2.0
   ------------------------------------------------------------
   Everything here comes from "NST Workshop Series.xlsx".
   Firestore overrides this at runtime (see store.js). If Firebase
   is not configured yet, the site runs entirely on this file, so
   you can publish immediately and wire the database later.

   >>> EDIT ME: fill in SERIES.contact + confirm the dates below.
   ============================================================ */

/* ---- Series identity ------------------------------------- */
export const SERIES = {
  name:      "NextGen Storytellers 2.0",
  kicker:    "Workshop Series",
  presenter: "National Showcasing Team",
  org:       "AIESEC in Sri Lanka",
  term:      "26.27 · Semester 01",
  tagline:   "Showcase Your Story",
  blurb:     "A four-week storytelling bootcamp from the National Showcasing Team: " +
             "design, edit, shoot and publish. Online masterclasses for everyone, " +
             "then hands-on physical workshops in Colombo and Kandy.",

  /* Season 1 recap: plays inline from the site, no TikTok redirect.
     "#t=1.2" makes the browser use the frame at 1.2s as the still,
     so no separate poster image is needed. */
  recapVideo: "assets/video/recap-nextgen-1.mp4#t=1.2",
  recapLabel: "Watch the 1.0 recap",

  /* >>> TODO: add your own handles. Blank entries are hidden automatically. */
  contact: {
    email:     "",                      // e.g. "showcasing@aiesec.lk"
    instagram: "",                      // e.g. "https://instagram.com/aiesecsrilanka"
    facebook:  "",
    linkedin:  "",
    phone:     "",                      // e.g. "+94 70 150 6924"
    tiktok:    "https://vt.tiktok.com/ZSg3ptMbv/",
    aiesec:    "https://aiesec.lk"
  },

  timezone:  "Asia/Colombo",
  tzLabel:   "IST (UTC+5:30)"
};

/* ---- Entities per physical day (Sheet 1: "Timeline") --------
   Every entity is shown, and stored when someone registers, as
   "AIESEC in <name>". */
const aiesecIn = list => list.map(n => `AIESEC in ${n}`);

export const CLUSTERS = [
  {
    id: "colombo", city: "Colombo", dateLabel: "Saturday 21 November",
    entities: aiesecIn([
      "Colombo North", "Colombo South", "Colombo Central", "USJ", "Ruhuna",
      "SLIIT", "IIT", "Saegis", "NIBM", "NSBM", "KDU", "SLTC", "Horizon Campus"
    ])
  },
  {
    id: "kandy", city: "Kandy", dateLabel: "Saturday 28 November",
    entities: aiesecIn([
      "EUSL", "SLIIT Kandy", "Vavuniya", "Jaffna", "Wayamba", "Rajarata", "Kandy"
    ])
  }
];

/* ---- Workshops (Sheets 1 + 2 + 3) -------------------------
   startAt / endAt are ISO strings WITH the +05:30 offset so the
   countdown is correct for every visitor, wherever they are.

   dateConfirmed:false  -> the card shows the "date TBC" note.
   joinUrl:""           -> the Join button stays hidden until an
                           admin adds the meeting link.
   capacity:null        -> no seat limit enforced.
   ----------------------------------------------------------- */
export const WORKSHOPS = [
  {
    id: "graphics-online",
    title: "Graphics Design Masterclass",
    type: "online",
    phase: "online",
    track: "Design",
    startAt: "2026-11-10T19:00:00+05:30",
    endAt:   "2026-11-10T21:30:00+05:30",
    dateConfirmed: true,
    durationLabel: "2h 30min",
    platform: "Google Meet",
    joinUrl: "",
    facilitators: ["Rasuwan", "Nimna"],
    tools: ["Adobe Photoshop"],
    resources: ["BlueBook", "AIESEC Resources Pack"],
    desc: "Brand-correct design from the ground up: the BlueBook rules, the AIESEC " +
          "resources pack, and a live Photoshop build of a real campaign asset.",
    registration: "open-to-all",
    capacity: null
  },
  {
    id: "video-editing-online",
    title: "Video Editing Masterclass",
    type: "online",
    phase: "online",
    track: "Video",
    startAt: "2026-11-12T19:00:00+05:30",
    endAt:   "2026-11-12T21:00:00+05:30",
    dateConfirmed: true,
    durationLabel: "2h",
    platform: "Google Meet",
    joinUrl: "",
    facilitators: ["Januki"],
    tools: ["Adobe Premiere Pro", "Adobe After Effects"],
    resources: [],
    desc: "Cut a story that holds attention: timeline craft in Premiere Pro, then " +
          "motion and titles in After Effects.",
    registration: "open-to-all",
    capacity: null
  },
  {
    id: "colombo-physical",
    title: "Physical Workshop · Colombo",
    type: "physical",
    phase: "colombo",
    track: "DXP + Videography",
    startAt: "2026-11-21T10:00:00+05:30",
    endAt:   "2026-11-21T17:30:00+05:30",
    dateConfirmed: true,
    durationLabel: "Full day · 10.00 – 17.30",
    venue: "University of Sri Jayewardenepura",
    joinUrl: "",
    facilitators: ["Dulain", "Achintha"],
    tools: ["Phone", "Laptop"],
    resources: [],
    desc: "A full hands-on day: Digital Experience Platform fundamentals before lunch, " +
          "then a practical videography block: shoot, direct and review on the spot.",
    registration: "register",
    capacity: null,
    entities: CLUSTERS[0].entities,
    modules: ["dxp", "videography"]
  },
  {
    id: "kandy-physical",
    title: "Physical Workshop · Kandy",
    type: "physical",
    phase: "kandy",
    track: "DXP + Videography",
    startAt: "2026-11-28T10:00:00+05:30",
    endAt:   "2026-11-28T17:30:00+05:30",
    dateConfirmed: true,
    durationLabel: "Full day · 10.00 – 17.30",
    venue: "University of Peradeniya",
    joinUrl: "",
    facilitators: ["Dulain", "Achintha"],
    tools: ["Phone", "Laptop"],
    resources: [],
    desc: "The Colombo day, run for the Kandy, Northern and North-Western cluster: " +
          "DXP theory in the morning, videography practical through the afternoon.",
    registration: "register",
    capacity: null,
    entities: CLUSTERS[1].entities,
    modules: ["dxp", "videography"]
  }
];

/* ---- Session modules inside the physical days (Sheet 2) ---- */
export const MODULES = [
  {
    id: "dxp",
    title: "DXP",
    full: "Digital Experience Platform",
    facilitators: ["Dulain", "Achintha"],
    covers: "Basic DXP theories",
    where: "Physical workshops only"
  },
  {
    id: "videography",
    title: "Videography",
    full: "Videography Practical",
    facilitators: ["Dulain", "Achintha"],
    covers: "Basic videography theories",
    where: "Physical workshops only"
  }
];

/* ---- People ----------------------------------------------- */
export const LEAD = { name: "Matheen", role: "MCVP BnM and NST Head", photo: "assets/img/team-matheen.jpg" };

export const MANAGERS = [
  { name: "Fathima",  role: "Brand Manager",       photo: "assets/img/team-fathima.jpg" },
  { name: "Dulain",   role: "Showcasing Manager",  photo: "assets/img/team-dulain.jpg", credit: true },
  { name: "Sathini",  role: "HR Manager",          photo: "assets/img/team-sathini.jpg" },
  { name: "Shahnaas", role: "B2B Manager",         photo: "assets/img/team-shahnaas.jpg" }
];

/* ---- All entities, grouped, for the registration dropdown -- */
export const ENTITY_GROUPS = [
  { label: "Colombo cluster", items: CLUSTERS[0].entities },
  { label: "Kandy cluster",   items: CLUSTERS[1].entities },
  { label: "Other",           items: ["Other / not listed"] }
];

/* ---- What attendees walk away with ------------------------ */
export const OUTCOMES = [
  {
    icon: "palette",
    title: "Design that stays on brand",
    text: "Work confidently inside the BlueBook and the AIESEC resources pack instead of guessing."
  },
  {
    icon: "film",
    title: "Edits people finish watching",
    text: "Premiere Pro and After Effects workflows built for short-form social, not 10-minute cuts."
  },
  {
    icon: "camera",
    title: "Footage worth editing",
    text: "Hands-on videography: framing, light and direction, practised on the day with real gear."
  },
  {
    icon: "rocket",
    title: "A DXP you can run",
    text: "The digital experience fundamentals every entity needs to showcase its own story."
  }
];

/* ---- FAQ (index.html) -------------------------------------
   Answers only restate what the rest of this file already says, so the
   FAQ cannot promise a date, venue or price that has not been decided.
   There is no question about cost: nothing in the plan says whether the
   sessions are free. Add one when you know.
   ----------------------------------------------------------- */
const names = a => a.length < 3
  ? a.join(" and ")
  : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
const crew = id => names([...WORKSHOPS, ...MODULES].find(x => x.id === id).facilitators);

export const FAQ = [
  {
    q: "Do I have to attend all four sessions?",
    a: "No. On the registration form you tick only the sessions you want: one, two, " +
       "three or all four. You can take the online masterclasses and skip the physical " +
       "day, or the other way round."
  },
  {
    q: "How do I register?",
    a: "Open the Register page, tick your sessions, then add your name, @aiesec.net " +
       "email, phone number and entity. If you tick a physical day it also asks what you want to " +
       "focus on and any dietary needs. When you confirm, you get a pass with your " +
       "reference code that you can save or print."
  },
  {
    q: "What is the difference between the online and the physical sessions?",
    a: "The two online masterclasses run live on Google Meet on 10 and 12 November: " +
       "Graphics Design and Video Editing, two to two and a half hours each. The " +
       "physical workshops are a full day, 10.00 to 17.30, at the University of Sri " +
       "Jayewardenepura for Colombo and the University of Peradeniya for Kandy, covering " +
       "DXP and hands-on videography."
  },
  {
    q: "Which physical workshop should I come to?",
    a: "Each day is planned around a cluster of entities. Colombo covers " +
       names(CLUSTERS[0].entities) + ". Kandy covers " + names(CLUSTERS[1].entities) + ". " +
       "If your entity is not listed, or you are not sure which day is yours, choose " +
       "“Other / not listed” on the form and ask us on the contact page."
  },
  {
    q: "What do I need to bring?",
    a: "For the online masterclasses, a laptop with the software installed: Photoshop " +
       "for the design session, and Premiere Pro plus After " +
       "Effects for the editing session. For the physical days, bring a laptop and your " +
       "phone. You do not need a camera."
  },
  {
    q: "How do I join an online session?",
    a: "Visit this site when the session starts. A full-screen “happening now” card " +
       "comes up with a join button, and a bar across the top of every page keeps the " +
       "link handy while it runs. The same link shows on the session card. Until the " +
       "team has added the meeting link, that button reads “Session details” instead."
  },
  {
    q: "Are places limited?",
    a: "A session can have a seat cap. When it does, the registration form shows how " +
       "many seats are left and marks the session full once they are gone, so " +
       "registering early is the safe move."
  },
  {
    q: "Do I need to be experienced already?",
    a: "No. The series starts from the basics: the design masterclass builds up from " +
       "the BlueBook rules and the AIESEC resources pack, the physical day covers " +
       "basic DXP and videography theory before the practical, and the form has a " +
       "“Complete beginner” option."
  },
  {
    q: "Who is teaching?",
    a: "Each session card names its facilitators. Graphics Design is " +
       crew("graphics-online") + "; Video Editing is " + crew("video-editing-online") +
       ". On the physical days, DXP and videography are both led by " + crew("dxp") + "."
  }
];
