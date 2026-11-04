/* ============================================================
   ui.js: shared chrome and behaviour for every page
   ------------------------------------------------------------
   mountChrome()   nav + drawer + live bar + takeover + footer
   mountCountdown() ring countdown that rolls into the live screen
   LiveWatch        one source of truth for "is a session live?"
   ============================================================ */

import { SERIES } from "./data.js";
import { onWorkshops, onLiveSettings } from "./store.js";
import { initStarfield, initWarp } from "./starfield.js";

/* ---------- icons ---------- */
export const ICONS = {
  calendar:  "M7 2v2H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3V2h-2v2H9V2H7zm13 8v10H4V10h16z",
  clock:     "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 5h-2v6l5 3 1-1.7-4-2.3V7z",
  pin:       "M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z",
  monitor:   "M3 4h18a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1h-7v2h4v2H6v-2h4v-2H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm1 2v9h16V6H4z",
  megaphone: "M3 10v4a1 1 0 0 0 1 1h2l4 4V5L6 9H4a1 1 0 0 0-1 1zm13.5 2a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 2.2v2.1a7.5 7.5 0 0 1 0 15.4v2.1a9.6 9.6 0 0 0 0-19.6z",
  play:      "M8 5v14l11-7z",
  users:     "M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 0a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-3 0-8 1.5-8 4.5V21h10v-3.5c0-1 .4-1.9 1-2.7A13 13 0 0 0 8 13zm8 0c-.7 0-1.5.1-2.3.2 1 .9 1.6 2 1.6 3.3V21h8v-3.5c0-3-5-4.5-7.3-4.5z",
  camera:    "M9 3l-2 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3l-2-2H9zm3 5a6 6 0 1 1 0 12 6 6 0 0 1 0-12zm0 2a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  film:      "M3 3h18a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 2v2h2V5H5zm12 0v2h2V5h-2zM5 9v6h14V9H5zm0 8v2h2v-2H5zm12 0v2h2v-2h-2z",
  palette:   "M12 2a10 10 0 0 0 0 20c1.1 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h2.3A4.7 4.7 0 0 0 22 10.8C22 5.9 17.5 2 12 2zM6.5 12a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3-4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm5 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z",
  rocket:    "M12 2c3.5 2 6 6 6 10l3 3-4 1-1 4-3-3h-2l-3 3-1-4-4-1 3-3c0-4 2.5-8 6-10zm0 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z",
  mail:      "M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 3.2V17h16V8.2l-8 5-8-5z",
  phone:     "M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.2c1.1.4 2.3.6 3.6.6a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.3.2 2.5.6 3.6a1 1 0 0 1-.2 1l-2.3 2.2z",
  instagram: "M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm0 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H7zm5 3a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm5.5-2.8a1.2 1.2 0 1 1 0 2.4 1.2 1.2 0 0 1 0-2.4z",
  tiktok:    "M16 2h-3v12.3a2.7 2.7 0 1 1-2.3-2.7V8.5a5.8 5.8 0 1 0 5.3 5.8V9.4a7.3 7.3 0 0 0 4 1.2V7.5A4.3 4.3 0 0 1 16 3.3V2z",
  facebook:  "M13 22v-9h3l.5-3.5H13V7.4c0-1 .3-1.7 1.8-1.7H17V2.6c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5V9.5H7V13h3v9h3z",
  linkedin:  "M4.5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM3 9h3v12H3V9zm6 0h2.9v1.7h.1c.4-.8 1.5-1.7 3.1-1.7 3.3 0 3.9 2.1 3.9 4.9V21h-3v-5.5c0-1.3 0-3-1.9-3s-2.1 1.4-2.1 2.9V21H9V9z",
  globe:     "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-2.5a15 15 0 0 0-1.4-3.6A8 8 0 0 1 18.9 8zM12 4.2c.7 1 1.3 2.3 1.7 3.8h-3.4c.4-1.5 1-2.8 1.7-3.8zM4.3 14a8 8 0 0 1 0-4h2.9a17 17 0 0 0 0 4H4.3zm.8 2h2.5c.3 1.3.8 2.5 1.4 3.6A8 8 0 0 1 5.1 16zm2.5-8H5.1a8 8 0 0 1 3.9-3.6A15 15 0 0 0 7.6 8zM12 19.8c-.7-1-1.3-2.3-1.7-3.8h3.4c-.4 1.5-1 2.8-1.7 3.8zm2.1-5.8H9.9a15 15 0 0 1 0-4h4.2a15 15 0 0 1 0 4zm.9 5.6c.6-1.1 1.1-2.3 1.4-3.6h2.5a8 8 0 0 1-3.9 3.6zm1.8-5.6a17 17 0 0 0 0-4h2.9a8 8 0 0 1 0 4h-2.9z",
  check:     "M9 16.2l-3.5-3.5L4 14.2l5 5 11-11-1.4-1.4z",
  alert:     "M12 2L1 21h22L12 2zm1 14h-2v2h2v-2zm0-7h-2v5h2V9z",
  info:      "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z",
  arrow:     "M5 12h12.2l-4.6-4.6L14 6l7 7-7 7-1.4-1.4 4.6-4.6H5z",
  video:     "M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z",
  star:      "M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4L12 2z",
  download:  "M12 3v10.2l3.6-3.6L17 11l-5 5-5-5 1.4-1.4L12 13.2V3zM5 19h14v2H5z",
  external:  "M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h5v2H6v11h11v-4h2v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  ticket:    "M4 5h16a1 1 0 0 1 1 1v3.5a2.5 2.5 0 0 0 0 5V18a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3.5a2.5 2.5 0 0 0 0-5V6a1 1 0 0 1 1-1zm11 2v2h2V7h-2zm0 4v2h2v-2h-2zm0 4v2h2v-2h-2z"
};

export function icon(name, cls = ""){
  const d = ICONS[name] || ICONS.star;
  return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
}

/* ---------- escaping ---------- */
/* Every form on the site takes AIESEC addresses only. firestore.rules checks this too. */
export function isAiesecEmail(s){
  return /^[^\s@]+@aiesec\.net$/i.test(String(s).trim());
}

export function esc(s){
  return String(s ?? "").replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

/* ---------- dates, always rendered in Sri Lanka time ---------- */
const TZ = SERIES.timezone;
const fDate  = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const fDay   = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fShort = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
const fTime  = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const fmt = {
  date:  d => (d ? fDate.format(d) : "TBC"),
  day:   d => (d ? fDay.format(d) : "TBC"),
  short: d => (d ? fShort.format(d) : "TBC"),
  time:  d => (d ? fTime.format(d) : ""),
  range(a, b){
    if (!a) return "Date to be confirmed";
    const t = b ? `${fTime.format(a)} – ${fTime.format(b)}` : fTime.format(a);
    return `${fDate.format(a)} · ${t}`;
  },
  isoDay: s => {
    const d = new Date(s + "T00:00:00+05:30");
    return isNaN(d) ? s : fShort.format(d);
  }
};

/* ---------- status of a workshop ---------- */
export function statusOf(w, now = new Date()){
  if (!w.startAt) return "tbc";
  if (w.endAt && now > w.endAt) return "done";
  if (now >= w.startAt && (!w.endAt || now <= w.endAt)) return "live";
  return "upcoming";
}

/* ---------- the live decision, in one place ---------- */
export function computeLive(workshops, settings, now = new Date()){
  const s = settings || { mode: "auto" };
  if (s.mode === "force-off") return null;

  if (s.mode === "force-on" && s.workshopId){
    const w = workshops.find(x => x.id === s.workshopId);
    if (w) return { ...w, joinUrl: s.joinUrl || w.joinUrl, _forced: true, _message: s.message || "" };
  }
  const nat = workshops.find(w => w.startAt && w.endAt && now >= w.startAt && now <= w.endAt);
  if (nat) return { ...nat, joinUrl: s.joinUrl || nat.joinUrl, _message: s.message || "" };
  return null;
}

export function nextUpcoming(workshops, now = new Date()){
  return workshops.filter(w => w.startAt && w.startAt > now)
                  .sort((a, b) => a.startAt - b.startAt)[0] || null;
}

/* ============================================================
   LiveWatch: subscribes once, tells everyone else
   ============================================================ */
class LiveWatch {
  constructor(){
    this.workshops = [];
    this.settings  = { mode: "auto" };
    this.listeners = new Set();     // every tick (for the live screen)
    this.dataListeners = new Set(); // only when the schedule itself changes
    this.live = null;
    this.next = null;
    this._sig = null;
    this._started = false;

    // ?preview=live  (optionally &w=<id>) forces the live screen on THIS
    // browser only, so the team can rehearse without touching the database.
    const q = new URLSearchParams(location.search);
    this.preview = q.get("preview") === "live";
    this.previewId = q.get("w") || "";
  }

  start(){
    if (this._started) return this;
    this._started = true;
    onWorkshops(list => { this.workshops = list; this._recalc(); });
    onLiveSettings(s  => { this.settings  = s;    this._recalc(); });
    this._tick = setInterval(() => this._recalc(), 1000);
    return this;
  }

  _recalc(){
    const now = new Date();
    let live = computeLive(this.workshops, this.settings, now);

    if (!live && this.preview && this.workshops.length){
      const target = this.previewId
        ? this.workshops.find(w => w.id === this.previewId)
        : (nextUpcoming(this.workshops, now) || this.workshops[0]);
      if (target) live = { ...target, _forced: true, _preview: true };
    }

    const changed = (live?.id || "") !== (this.live?.id || "");
    this.live = live;
    this.next = nextUpcoming(this.workshops, now);
    this.listeners.forEach(fn => { try{ fn(this, changed); }catch(e){ console.error(e); } });

    // Anything that rebuilds markup listens here instead, so a half-filled
    // form is never wiped by the once-a-second tick.
    const sig = this._signature();
    if (sig !== this._sig){
      this._sig = sig;
      this.dataListeners.forEach(fn => { try{ fn(this); }catch(e){ console.error(e); } });
    }
  }

  _signature(){
    return this.workshops.map(w => [
      w.id, w.title, w.type, w.startAt?.getTime() || 0, w.endAt?.getTime() || 0,
      w.joinUrl, w.venue, w.platform, w.capacity, w.seatsTaken,
      w.registrationOpen, w.dateConfirmed, w.dateNote
    ].join("~")).join("|");
  }

  on(fn){
    this.listeners.add(fn);
    if (this.workshops.length) fn(this, true);
    return () => this.listeners.delete(fn);
  }

  onData(fn){
    this.dataListeners.add(fn);
    if (this.workshops.length) fn(this);
    return () => this.dataListeners.delete(fn);
  }
}

export const liveWatch = new LiveWatch();

/* ============================================================
   Chrome
   ============================================================ */
const NAV = [
  { href: "index.html",     label: "Home" },
  { href: "workshops.html", label: "Workshops" },
  { href: "register.html",  label: "Register" },
  { href: "contact.html",   label: "Contact" }
];

export function mountChrome({ active = "" } = {}){
  /* --- background layers --- */
  if (!document.querySelector(".cosmos")){
    const cosmos = document.createElement("div");
    cosmos.className = "cosmos";
    document.body.prepend(cosmos);
  }
  let canvas = document.getElementById("starfield");
  if (!canvas){
    canvas = document.createElement("canvas");
    canvas.id = "starfield";
    document.body.prepend(canvas);
  }
  const field = initStarfield(canvas, { density: 1, constellation: true });

  /* --- gradient used by the countdown rings --- */
  if (!document.getElementById("ngDefs")){
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.id = "ngDefs";
    svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
    svg.style.position = "absolute";
    svg.innerHTML = `<defs>
      <linearGradient id="ngGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stop-color="#a855f7"/>
        <stop offset="55%"  stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#d946ef"/>
      </linearGradient>
    </defs>`;
    document.body.appendChild(svg);
  }

  /* --- live bar --- */
  const bar = document.createElement("div");
  bar.className = "livebar";
  bar.id = "livebar";
  document.body.prepend(bar);

  /* --- nav --- */
  const nav = document.createElement("header");
  nav.className = "nav";
  nav.innerHTML = `
    <div class="shell">
      <div class="nav__inner">
        <a class="nav__brand" href="index.html" aria-label="${esc(SERIES.name)} home">
          <img src="assets/img/nextgen-logo.png" alt="NextGen Storytellers">
          <span class="nav__brand-txt">
            <b>2.0 &middot; Workshop Series</b>
            <span>National Showcasing Team</span>
          </span>
        </a>
        <nav class="nav__links" aria-label="Main">
          ${NAV.map(n => `<a href="${n.href}"${n.href === active ? ' class="is-active" aria-current="page"' : ""}>${n.label}</a>`).join("")}
        </nav>
        <div class="nav__cta">
          <a class="btn btn--sm" href="register.html">Register</a>
          <button class="nav__burger" id="burger" aria-label="Open menu" aria-expanded="false"><span></span></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(nav);

  const drawer = document.createElement("div");
  drawer.className = "nav__drawer";
  drawer.id = "drawer";
  drawer.innerHTML = NAV.map(n => `<a href="${n.href}">${n.label}</a>`).join("");
  document.body.appendChild(drawer);

  const burger = nav.querySelector("#burger");
  burger.addEventListener("click", () => {
    const open = drawer.classList.toggle("is-open");
    burger.classList.toggle("is-open", open);
    burger.setAttribute("aria-expanded", String(open));
    document.body.style.overflow = open ? "hidden" : "";
  });
  drawer.addEventListener("click", e => {
    if (e.target.tagName === "A"){
      drawer.classList.remove("is-open");
      burger.classList.remove("is-open");
      burger.setAttribute("aria-expanded", "false");
      document.body.style.overflow = "";
    }
  });

  let lastY = window.scrollY;
  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle("is-stuck", y > 24);
    nav.classList.toggle("is-away", y > lastY && y > 300);
    lastY = y;
  };
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* --- takeover --- */
  const take = document.createElement("div");
  take.className = "takeover";
  take.id = "takeover";
  take.setAttribute("role", "dialog");
  take.setAttribute("aria-modal", "true");
  take.setAttribute("aria-label", "Session happening now");
  take.innerHTML = `
    <canvas class="takeover__warp" id="warp"></canvas>
    <button class="takeover__close" id="takeClose" aria-label="Close">&times;</button>
    <div class="takeover__inner" id="takeInner"></div>`;
  document.body.appendChild(take);
  const warp = initWarp(take.querySelector("#warp"));

  /* --- soundtrack --- */
  mountSound();

  /* --- footer --- */
  mountFooter();

  /* --- shared behaviours --- */
  initReveal();
  initCursor();

  /* --- wire the live state --- */
  liveWatch.start();
  liveWatch.on(w => paintLive(w, { bar, take, warp }));

  return { field, warp };
}

/* ============================================================
   Soundtrack
   ------------------------------------------------------------
   On by default; browsers may hold it until the visitor's first
   interaction, and the toggle on the right edge always shows the true
   state. Video on the page pauses it and hands it back after.
   ============================================================ */
export const sound = {
  _audio: null, _on: false, _duckedBy: 0, _btn: null,
  get isOn(){ return this._on; },
  play(){ this._audio?.play().catch(() => {}); },
  pause(){ this._audio?.pause(); },
  /* Something else wants the speakers (a video). Give them up. */
  duck(){ this._duckedBy++; if (this._on) this.pause(); },
  unduck(){ this._duckedBy = Math.max(0, this._duckedBy - 1); if (!this._duckedBy && this._on) this.play(); }
};

const SOUND_KEY = "nst2:sound";
const SOUND_POS = "nst2:soundPos";   // per tab: two tabs must not fight over it

function mountSound(){
  if (document.getElementById("soundBtn")) return;

  const audio = new Audio("assets/audio/nst-theme.m4a");
  audio.loop = true;
  audio.volume = 0.3;
  audio.preload = "auto";
  audio.id = "nstTheme";
  audio.hidden = true;
  document.body.appendChild(audio);   // in the DOM so OS media controls find it
  sound._audio = audio;

  /* A page change tears the player down, so the song's place is noted as it
     plays and picked up by the next page: plus however long the switch took,
     since the song would have kept going. */
  let saved = null;
  try{ saved = JSON.parse(sessionStorage.getItem(SOUND_POS) || "null"); }catch{}
  const resume = () => {
    if (!saved || !(audio.duration > 0)) return;
    const away = saved.playing ? Math.min(10, (Date.now() - saved.at) / 1000) : 0;
    audio.currentTime = (saved.t + away) % audio.duration;
    saved = null;
  };
  if (audio.readyState >= 1) resume();
  else audio.addEventListener("loadedmetadata", resume, { once: true });

  const savePos = () => {
    if (saved) return;   // not resumed yet: do not overwrite the real position with 0
    try{
      sessionStorage.setItem(SOUND_POS, JSON.stringify({ t: audio.currentTime, at: Date.now(), playing: !audio.paused }));
    }catch{}
  };
  audio.addEventListener("timeupdate", savePos);
  window.addEventListener("pagehide", savePos);

  const btn = document.createElement("button");
  btn.className = "sound";
  btn.id = "soundBtn";
  btn.type = "button";
  btn.innerHTML = `<span class="sound__bars" aria-hidden="true"><i></i><i></i><i></i></span>
                   <span class="sound__lbl">Sound</span>`;
  document.body.appendChild(btn);
  sound._btn = btn;

  let stored;
  try{ stored = localStorage.getItem(SOUND_KEY); }catch{}
  // On by default: off only if the visitor has turned it off before.
  sound._on = stored !== "0";

  /* The label says what is actually happening, not just what was asked for:
     if the browser is still holding playback back, it says so. */
  function sync(){
    const playing = sound._on && !audio.paused;
    btn.classList.toggle("is-on", playing);
    btn.setAttribute("aria-pressed", String(sound._on));
    btn.setAttribute("aria-label", sound._on ? "Turn the music off" : "Turn the music on");
    btn.querySelector(".sound__lbl").textContent =
      !sound._on        ? "Sound off"
      : playing         ? "Sound on"
      : sound._duckedBy ? "Paused"
      :                   "Tap for sound";
  }

  btn.addEventListener("click", () => {
    sound._on = !sound._on;
    btn.classList.remove("is-hint");
    try{ localStorage.setItem(SOUND_KEY, sound._on ? "1" : "0"); }catch{}
    if (sound._on) sound.play(); else sound.pause();
    sync();
  });

  if (sound._on){
    // Try straight away. Every browser blocks audio until the visitor has
    // interacted with the page, so if it is refused we start on their very
    // first click, tap, key or scroll instead: and the toggle shows the
    // real state the whole time.
    sound.play();
    const kick = () => {
      if (sound._on && !sound._duckedBy) sound.play();
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach(e =>
        document.removeEventListener(e, kick));
    };
    ["pointerdown", "keydown", "wheel", "touchstart"].forEach(e =>
      document.addEventListener(e, kick, { once: true, passive: true }));

    if (stored === null) btn.classList.add("is-hint");   // first visit: a nudge
  }

  audio.addEventListener("play",  sync);
  audio.addEventListener("pause", sync);
  sync();
}

/* ---------- footer (same shape as the WLL site) ---------- */
function mountFooter(){
  const c = SERIES.contact;
  const social = [
    c.instagram && { href: c.instagram, ic: "instagram", label: "Instagram" },
    c.tiktok    && { href: c.tiktok,    ic: "tiktok",    label: "TikTok" },
    c.facebook  && { href: c.facebook,  ic: "facebook",  label: "Facebook" },
    c.linkedin  && { href: c.linkedin,  ic: "linkedin",  label: "LinkedIn" },
    c.aiesec    && { href: c.aiesec,    ic: "globe",     label: "AIESEC Sri Lanka" }
  ].filter(Boolean);

  const connect = [
    c.instagram && `<a href="${esc(c.instagram)}" target="_blank" rel="noopener">Instagram</a>`,
    c.tiktok    && `<a href="${esc(c.tiktok)}" target="_blank" rel="noopener">TikTok</a>`,
    c.email     && `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>`,
    c.phone     && `<a href="tel:${esc(c.phone.replace(/\s/g, ""))}">${esc(c.phone)}</a>`,
    c.aiesec    && `<a href="${esc(c.aiesec)}" target="_blank" rel="noopener">AIESEC Sri Lanka</a>`
  ].filter(Boolean).join("");

  const f = document.createElement("footer");
  f.className = "footer";
  f.innerHTML = `
    <div class="shell">
      <div class="footer__top">
        <div class="footer__brand">
          <a href="${esc(c.aiesec || "https://aiesec.lk")}" target="_blank" rel="noopener">
            <img src="assets/img/aiesec-logo-white.png" alt="${esc(SERIES.org)}">
          </a>
          <p>${esc(SERIES.name)} is the ${esc(SERIES.kicker.toLowerCase())} run by the
             ${esc(SERIES.presenter)} of ${esc(SERIES.org)}, training the next generation of
             storytellers across every entity in the country.</p>
          <div class="footer__org">An initiative of the ${esc(SERIES.presenter)}</div>
          ${social.length ? `<div class="footer__socials">${social.map(s =>
            `<a href="${esc(s.href)}" target="_blank" rel="noopener" aria-label="${esc(s.label)}">${icon(s.ic)}</a>`
          ).join("")}</div>` : ""}
        </div>
        <div class="footer__cols">
          <div class="footer__col">
            <h5>Explore</h5>
            <a href="index.html">Home</a>
            <a href="index.html#series">The Series</a>
            <a href="workshops.html">Workshops</a>
            <a href="index.html#recap">Recap</a>
            <a href="index.html#faq">FAQ</a>
            <a href="contact.html">Contact</a>
          </div>
          <div class="footer__col">
            <h5>Take part</h5>
            <a href="register.html">Register for Colombo</a>
            <a href="register.html">Register for Kandy</a>
            <a href="workshops.html#online">Online sessions</a>
          </div>
          <div class="footer__col">
            <h5>Connect</h5>
            ${connect || '<a href="contact.html">Contact the team</a>'}
          </div>
        </div>
      </div>
      <div class="footer__starbar" aria-hidden="true"></div>
      <div class="footer__bottom">
        <span>&copy; ${new Date().getFullYear()} ${esc(SERIES.name)} &middot; ${esc(SERIES.org)}</span>
        <span class="footer__by"><a class="footer__star" href="contact.html#dulain" aria-label="See who this credit belongs to">*</a>Developed by the ${esc(SERIES.presenter)}</span>
        <span>${esc(SERIES.tagline)} &middot; ${esc(SERIES.term)}</span>
      </div>
    </div>`;
  f.insertAdjacentHTML("beforeend", `<div class="footer__word" aria-hidden="true">${esc(SERIES.tagline)}</div>`);
  document.body.appendChild(f);
}

/* ---------- paint the live bar + takeover ---------- */
const SEEN_KEY = "nst2:takeoverSeen";
function seenSet(){
  try{ return new Set(JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]")); }catch{ return new Set(); }
}
function markSeen(id){
  const s = seenSet(); s.add(id);
  try{ sessionStorage.setItem(SEEN_KEY, JSON.stringify([...s])); }catch{}
}

/* LiveWatch ticks once a second. Re-rendering the takeover on every tick
   would stack event listeners and fight the user's clicks, so both the bar
   and the overlay are rebuilt only when what they say actually changes. */
let lastBarKey = null;
let lastTakeKey = null;
let chromeBound = false;

function paintLive(watch, { bar, take, warp }){
  const live = watch.live;

  if (!chromeBound){
    chromeBound = true;
    take.querySelector("#takeClose").addEventListener("click", () => {
      if (liveWatch.live) markSeen(liveWatch.live.id);
      hideTakeover(take, warp);
    });
    document.addEventListener("keydown", e => {
      if (e.key !== "Escape" || !take.classList.contains("is-on")) return;
      if (liveWatch.live) markSeen(liveWatch.live.id);
      hideTakeover(take, warp);
    });
  }

  /* --- bar --- */
  const barKey = live ? `${live.id}|${live.joinUrl || ""}|${live.type}|${live._preview ? 1 : 0}` : "";
  if (barKey === lastBarKey){
    if (live) document.documentElement.style.setProperty("--livebar-h", bar.offsetHeight + "px");
  }else{
    lastBarKey = barKey;
    paintBar(bar, live);
  }

  /* --- takeover --- */
  if (!live){ lastTakeKey = null; hideTakeover(take, warp); return; }
  if (seenSet().has(live.id)) return;

  const takeKey = `${live.id}|${live.joinUrl || ""}|${live._message || ""}|${live._preview ? 1 : 0}`;
  if (takeKey !== lastTakeKey){
    lastTakeKey = takeKey;
    paintTakeover(take, warp, live);
  }
  if (!take.classList.contains("is-on")){
    take.classList.add("is-on");
    document.body.style.overflow = "hidden";
    warp.start();
  }
}

function paintBar(bar, live){
  if (live){
    const online = live.type === "online";
    const join = live.joinUrl || "";
    bar.innerHTML = `
      <span class="livebar__tag"><i class="dot dot--pulse"></i> Live now</span>
      <span>${esc(live.title)} ${online ? "is streaming" : "is under way"}${live._preview ? " (preview)" : ""}</span>
      ${join
        ? `<a class="livebar__join" href="${esc(join)}" target="_blank" rel="noopener">Join now &rarr;</a>`
        : `<a class="livebar__join" href="workshops.html">See details &rarr;</a>`}`;
    bar.classList.add("is-on");
    document.body.classList.add("has-livebar");
    document.documentElement.style.setProperty("--livebar-h", bar.offsetHeight + "px");
  }else{
    bar.classList.remove("is-on");
    document.body.classList.remove("has-livebar");
  }
}

function paintTakeover(take, warp, live){
  const online = live.type === "online";
  const join = live.joinUrl || "";
  const inner = take.querySelector("#takeInner");
  inner.innerHTML = `
    <span class="takeover__pill"><i class="dot dot--pulse"></i> ${live._preview ? "Preview &middot; " : ""}Happening now</span>
    <p class="takeover__kicker">${esc(SERIES.name)}</p>
    <h2 class="takeover__title">${esc(live.title)}</h2>
    <p class="takeover__sub">${esc(live._message || (online
        ? "The session has started. Jump in and we will catch you up."
        : "The workshop is under way."))}</p>
    <div class="takeover__meta">
      <span>${icon("clock", "")} ${esc(fmt.time(live.startAt))} – ${esc(fmt.time(live.endAt))} ${esc(SERIES.tzLabel)}</span>
      ${online
        ? `<span>${icon("video", "")} ${esc(live.platform || "Online")}</span>`
        : `<span>${icon("pin", "")} ${esc(live.venue || "Venue announced on the day")}</span>`}
      ${live.facilitators?.length ? `<span>${icon("users", "")} ${esc(live.facilitators.join(", "))}</span>` : ""}
    </div>
    <div class="takeover__actions">
      ${join
        ? `<a class="btn btn--live btn--lg" href="${esc(join)}" target="_blank" rel="noopener">${icon("video", "")} Join now</a>`
        : `<a class="btn btn--lg" href="workshops.html">${icon("arrow", "")} Session details</a>`}
      <button class="btn btn--ghost btn--lg" data-close>Stay on the site</button>
    </div>`;

  inner.querySelectorAll("svg").forEach(s => { s.style.width = "17px"; s.style.height = "17px"; s.style.fill = "currentColor"; });
  inner.querySelector("[data-close]")?.addEventListener("click", () => {
    markSeen(live.id);
    hideTakeover(take, warp);
  });
}

function hideTakeover(take, warp){
  if (!take.classList.contains("is-on")) return;
  take.classList.remove("is-on");
  document.body.style.overflow = "";
  warp.stop();
}

/* ============================================================
   Countdown
   ============================================================ */
export function mountCountdown(el, getWorkshop){
  if (!el) return () => {};
  let lastId = null;

  function shell(w){
    el.innerHTML = `
      <div class="countdown__head">
        <div class="countdown__what">
          <span class="eyebrow" id="cdEyebrow">Next up</span>
          <h3 id="cdTitle">${esc(w.title)}</h3>
          <div class="countdown__meta" id="cdMeta"></div>
        </div>
        <div class="btn-row" id="cdActions"></div>
      </div>
      <div class="clock">
        ${["Days", "Hours", "Minutes", "Seconds"].map(l => `
          <div class="unit">
            <span class="unit__num" data-u="${l.toLowerCase()}">--</span>
            <span class="unit__lbl">${l}</span>
          </div>`).join("")}
      </div>
      <div class="countdown__foot">
        <span class="countdown__note" id="cdNote"></span>
        <a class="btn btn--ghost btn--sm" href="workshops.html">All sessions ${icon("arrow")}</a>
      </div>`;
  }

  function tick(){
    const w = getWorkshop();
    if (!w){
      el.innerHTML = `<div class="countdown__head"><div class="countdown__what">
        <span class="eyebrow">The series</span>
        <h3>Dates are being locked in</h3>
        <div class="countdown__meta"><span>Check back shortly. Every session lands here first.</span></div>
      </div></div>`;
      lastId = null;
      return;
    }
    if (w.id !== lastId){ shell(w); lastId = w.id; }

    const now = new Date();
    const live = w.endAt && now >= w.startAt && now <= w.endAt;

    el.classList.toggle("is-live", !!live);
    const eyebrow = el.querySelector("#cdEyebrow");
    const meta = el.querySelector("#cdMeta");
    const note = el.querySelector("#cdNote");

    if (live){
      if (eyebrow) eyebrow.innerHTML = `<i class="dot dot--pulse" style="display:inline-block;color:var(--live)"></i> Happening now`;
      el.querySelectorAll(".unit__num").forEach(n => n.textContent = "00");
      if (note) note.textContent = "In session.";
      if (meta){
        meta.innerHTML = `<span>${fmt.range(w.startAt, w.endAt)} ${esc(SERIES.tzLabel)}</span>`;
        const act = el.querySelector("#cdActions");
        if (act && w.joinUrl && !act.querySelector("[data-join]")){
          act.insertAdjacentHTML("afterbegin",
            `<a data-join class="btn btn--live" href="${esc(w.joinUrl)}" target="_blank" rel="noopener">Join now</a>`);
        }
      }
      return;
    }

    let ms = w.startAt - now;
    if (ms < 0) ms = 0;
    const s = Math.floor(ms / 1000);
    const put = (u, v) => {
      const n = el.querySelector(`[data-u="${u}"]`);
      if (n) n.textContent = String(v).padStart(2, "0");
    };
    put("days", Math.floor(s / 86400));
    put("hours", Math.floor((s % 86400) / 3600));
    put("minutes", Math.floor((s % 3600) / 60));
    put("seconds", s % 60);

    if (eyebrow) eyebrow.textContent = "Next up";
    if (meta){
      meta.innerHTML = [
        `<span>${esc(fmt.day(w.startAt))}</span>`,
        `<span>${esc(fmt.time(w.startAt))} – ${esc(fmt.time(w.endAt))} ${esc(SERIES.tzLabel)}</span>`,
        `<span>${esc(w.type === "online" ? (w.platform || "Online") : (w.venue || "Venue TBA"))}</span>`
      ].join("");
    }
    if (note){
      note.textContent = w.dateConfirmed === false
        ? (w.dateNote || "Provisional date. We will confirm here as soon as it is locked.")
        : `All times shown in ${SERIES.tzLabel}.`;
    }
  }

  tick();
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
}

/* ============================================================
   Small shared behaviours
   ============================================================ */
export function initReveal(root = document){
  const items = root.querySelectorAll(".reveal:not(.is-in)");
  if (!("IntersectionObserver" in window)){
    items.forEach(i => i.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries, obs) => {
    entries.forEach(e => {
      if (e.isIntersecting){ e.target.classList.add("is-in"); obs.unobserve(e.target); }
    });
  }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
  items.forEach(i => io.observe(i));
  return io;
}

/* A cursor that grows and names what you are about to do. Mouse only. */
function initCursor(){
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const c = document.createElement("div");
  c.className = "cursor";
  c.setAttribute("aria-hidden", "true");
  c.innerHTML = "<span></span>";
  document.body.appendChild(c);
  const label = c.firstChild;
  window.addEventListener("pointermove", e => {
    c.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
    c.classList.add("is-on");
    const t = e.target.closest?.("[data-cursor]");
    c.classList.toggle("is-big", !!t);
    if (t) label.textContent = t.dataset.cursor;
  }, { passive: true });
  document.documentElement.addEventListener("pointerleave", () => c.classList.remove("is-on"));
}

/* Count a number up when it scrolls into view. */
export function animateNumber(el, to, { dur = 1400, suffix = "" } = {}){
  const start = performance.now();
  let done = false;
  const finish = () => { if (!done){ done = true; el.textContent = to + suffix; } };

  function step(now){
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    if (!done) el.textContent = Math.round(to * eased) + suffix;
    if (p < 1) requestAnimationFrame(step); else finish();
  }
  el.textContent = "0" + suffix;
  requestAnimationFrame(step);
  // If rAF is throttled (background tab, embedded pane) land on the real
  // number anyway: a stat stuck at "3 entities" is worse than no animation.
  setTimeout(finish, dur + 300);
}

export function initials(name){
  return String(name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0] || "").join("").toUpperCase();
}
