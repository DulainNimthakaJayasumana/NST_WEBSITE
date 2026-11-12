/* ============================================================
   home.js: index.html
   ============================================================ */

import { OUTCOMES, CLUSTERS, FAQ } from "./data.js";
import { mountChrome, mountCountdown, liveWatch, initReveal, sound, isAiesecEmail } from "./ui.js";
import { renderWorkshops, renderPhases, renderOutcomes, renderFaq, renderMarquee } from "./cards.js";
import { subscribeEmail } from "./store.js";

mountChrome({ active: "index.html" });

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- static blocks ---------- */
renderOutcomes(document.getElementById("outcomes"), OUTCOMES);
renderFaq(document.getElementById("faqList"), FAQ);
renderMarquee(document.getElementById("tagMarquee"), ["Showcase your story", "Design", "Edit", "Shoot", "Publish"]);
renderMarquee(document.getElementById("entityMarquee"), CLUSTERS.flatMap(c => c.entities));

/* ---------- the road map pins and travels sideways ---------- */
const hs = document.querySelector(".hscroll");
const track = document.getElementById("roadmap");
if (hs && track && !REDUCED){
  const wide = window.matchMedia("(min-width: 901px)");
  let travel = 0;

  function measure(){
    hs.classList.toggle("is-pinned", wide.matches);
    if (!wide.matches){
      hs.style.height = "";
      track.style.transform = "";
      return;
    }
    travel = Math.max(0, track.scrollWidth - window.innerWidth);
    hs.style.height = `${window.innerHeight + travel}px`;
    move();
  }
  function move(){
    if (!wide.matches) return;
    const p = Math.min(1, Math.max(0, -hs.getBoundingClientRect().top / Math.max(1, travel)));
    track.style.transform = `translate3d(${-p * travel}px,0,0)`;
  }
  window.addEventListener("scroll", move, { passive: true });
  window.addEventListener("resize", measure, { passive: true });
  document.fonts?.ready.then(measure);
  measure();
}

/* ---------- recap: plays inline, no redirect ---------- */
const recapCard  = document.getElementById("recapCard");
const recapVideo = document.getElementById("recapVideo");

const vp = document.getElementById("recapControls");

/* Lucide icons (play, pause, volume-2, volume-1, volume-x), inline. */
const ICON = (() => {
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const spk = `<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/>`;
  return {
    play:  svg(`<polygon points="6 3 20 12 6 21 6 3"/>`),
    pause: svg(`<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>`),
    vol2:  svg(spk + `<path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/>`),
    vol1:  svg(spk + `<path d="M16 9a5 5 0 0 1 0 6"/>`),
    volx:  svg(spk + `<line x1="22" x2="16" y1="9" y2="15"/><line x1="16" x2="22" y1="9" y2="15"/>`)
  };
})();

function playRecap(){
  if (!recapVideo) return;
  recapCard?.classList.add("is-playing");
  recapCard?.removeAttribute("data-cursor");   // the big "Play" cursor would sit over the controls
  if (vp) vp.hidden = false;
  recapVideo.play().catch(() => syncPlayer());   // blocked: the controls show, so they can start it
  recapCard?.scrollIntoView({ block: "center", behavior: "smooth" });
}

document.getElementById("recapPlay")?.addEventListener("click", playRecap);
document.getElementById("recapBtn")?.addEventListener("click", playRecap);

/* ---------- recap player controls ---------- */
const fmtTime = s => {
  s = isFinite(s) ? s : 0;
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
const $vp = id => document.getElementById(id);
const seekEl = $vp("vpSeek"), volEl = $vp("vpVol"), playBtn = $vp("vpPlay"), muteBtn = $vp("vpMute");

function setFill(el, pct){
  pct = Math.min(100, Math.max(0, pct || 0));
  el.firstElementChild.style.width = pct + "%";
  el.setAttribute("aria-valuenow", String(Math.round(pct)));
}

function syncPlayer(){
  if (!recapVideo || !vp) return;
  const v = recapVideo, playing = !v.paused && !v.ended;
  playBtn.innerHTML = playing ? ICON.pause : ICON.play;
  playBtn.setAttribute("aria-label", playing ? "Pause" : "Play");
  const vol = v.muted ? 0 : v.volume;
  muteBtn.innerHTML = vol === 0 ? ICON.volx : vol > .5 ? ICON.vol2 : ICON.vol1;
  muteBtn.setAttribute("aria-label", vol === 0 ? "Unmute" : "Mute");
  setFill(volEl, vol * 100);
  recapCard.classList.toggle("is-paused", !playing);
}

function syncTime(){
  const v = recapVideo;
  $vp("vpCur").textContent = fmtTime(v.currentTime);
  $vp("vpDur").textContent = fmtTime(v.duration);
  if (!seekEl.classList.contains("is-drag")) setFill(seekEl, v.currentTime / v.duration * 100);
}

/* Click or drag along a slider: reports 0-100. */
function slider(el, onChange){
  const pct = e => { const r = el.getBoundingClientRect(); return (e.clientX - r.left) / r.width * 100; };
  el.addEventListener("pointerdown", e => {
    el.setPointerCapture(e.pointerId);
    el.classList.add("is-drag");
    onChange(Math.min(100, Math.max(0, pct(e))));
  });
  el.addEventListener("pointermove", e => { if (el.classList.contains("is-drag")) onChange(Math.min(100, Math.max(0, pct(e)))); });
  const end = () => el.classList.remove("is-drag");
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", end);
  el.addEventListener("keydown", e => {
    const now = +el.getAttribute("aria-valuenow");
    const step = { ArrowRight: 5, ArrowUp: 5, ArrowLeft: -5, ArrowDown: -5 }[e.key];
    if (step == null) return;
    e.preventDefault();
    onChange(Math.min(100, Math.max(0, now + step)));
  });
}

if (recapVideo && vp){
  const v = recapVideo;
  slider(seekEl, p => {
    if (!(v.duration > 0)) return;
    v.currentTime = p / 100 * v.duration;
    setFill(seekEl, p);
  });
  slider(volEl, p => {
    v.volume = p / 100;
    v.muted = p === 0;
    syncPlayer();
  });

  const togglePlay = () => { if (v.paused || v.ended) v.play().catch(() => {}); else v.pause(); };
  playBtn.addEventListener("click", togglePlay);
  v.addEventListener("click", () => { if (recapCard.classList.contains("is-playing")) togglePlay(); });

  muteBtn.addEventListener("click", () => {
    // as in the template: unmuting brings the volume back to full
    if (v.muted || v.volume === 0){ v.muted = false; v.volume = 1; }
    else v.muted = true;
    syncPlayer();
  });

  $vp("vpSpeeds").addEventListener("click", e => {
    const b = e.target.closest("[data-speed]");
    if (!b) return;
    v.playbackRate = +b.dataset.speed;
    vp.querySelectorAll(".vp__spd").forEach(x => x.classList.toggle("is-on", x === b));
  });

  /* Controls show while the pointer is over the video, while paused, and for
     a moment after a tap (touch screens have no hover). */
  let hideT;
  const peek = () => {
    recapCard.classList.add("show-ctl");
    clearTimeout(hideT);
    hideT = setTimeout(() => { if (!recapCard.matches(":hover") && !vp.contains(document.activeElement)) recapCard.classList.remove("show-ctl"); }, 2600);
  };
  recapCard.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") recapCard.classList.add("show-ctl"); });
  recapCard.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") recapCard.classList.remove("show-ctl"); });
  recapCard.addEventListener("pointerdown", e => { if (e.pointerType !== "mouse") peek(); });
  vp.addEventListener("focusin", () => recapCard.classList.add("show-ctl"));

  ["play", "pause", "ended", "volumechange"].forEach(ev => v.addEventListener(ev, syncPlayer));
  ["timeupdate", "loadedmetadata", "durationchange", "seeked"].forEach(ev => v.addEventListener(ev, syncTime));
  syncPlayer();
}

/* The recap has its own audio, so the soundtrack steps aside while it runs
   and comes back when it stops. Paired strictly one-for-one. */
let ducked = false;
const duck   = () => { if (!ducked){ ducked = true;  sound.duck(); } };
const unduck = () => { if (ducked) { ducked = false; sound.unduck(); } };

recapVideo?.addEventListener("play",  duck);
recapVideo?.addEventListener("pause", unduck);
recapVideo?.addEventListener("ended", () => {
  unduck();
  recapCard?.classList.remove("is-playing", "show-ctl");
  if (vp) vp.hidden = true;
  recapCard?.setAttribute("data-cursor", "Play");
  recapVideo.currentTime = 1.2;
});

/* ---------- sessions + countdown, live from the store ---------- */
const grid = document.getElementById("sessionGrid");
const box  = document.getElementById("countdownBox");

liveWatch.onData(w => {
  renderWorkshops(grid, w.workshops);
  initReveal(grid);
  renderPhases(document.getElementById("roadmap"), w.workshops);
  window.dispatchEvent(new Event("resize"));   // the sideways road map re-measures itself
});

/* The countdown always points at whatever is live, else what is next. */
mountCountdown(box, () => liveWatch.live || liveWatch.next || null);

/* ---------- the word that keeps changing ---------- */
const rotEl = document.getElementById("rotator");
if (rotEl){
  const words = ["design", "edit", "shoot", "publish"];
  rotEl.innerHTML = words
    .map((w, i) => `<span class="${i === 0 ? "is-in" : ""}">${w}</span>`).join("");
  const items = [...rotEl.children];
  let cur = 0;
  setInterval(() => {
    const prev = cur;
    items[prev].classList.replace("is-in", "is-out");
    cur = (cur + 1) % items.length;
    items[cur].classList.remove("is-out");
    items[cur].classList.add("is-in");
    setTimeout(() => items[prev].classList.remove("is-out"), 700);
  }, 2100);
}

/* ---------- the logo leans with the pointer ---------- */
const heroLogo = document.getElementById("heroLogo");
if (heroLogo && !REDUCED){
  heroLogo.style.transition = "transform .9s cubic-bezier(.16,1,.3,1)";
  window.addEventListener("pointermove", e => {
    if (window.scrollY > window.innerHeight) return;
    const x = (e.clientX / window.innerWidth  - .5) * 2;
    const y = (e.clientY / window.innerHeight - .5) * 2;
    heroLogo.style.transform = `translate3d(${x * 14}px,${y * 10}px,0)`;
  }, { passive: true });
}

/* ---------- the animated logo ---------- */
/* Some browsers refuse autoplay until the user interacts; retry quietly.
   If the clip will not load at all, remove it rather than leave a gap. */
const vid = document.getElementById("heroVideo");
if (vid){
  const tryPlay = () => vid.play().catch(() => {});
  tryPlay();
  vid.addEventListener("loadeddata", tryPlay, { once: true });
  document.addEventListener("pointerdown", tryPlay, { once: true });
  vid.addEventListener("error", () => vid.remove(), { once: true });
}

/* ---------- mailing list ---------- */
const form = document.getElementById("subForm");
const msg  = document.getElementById("subMsg");
form?.addEventListener("submit", async e => {
  e.preventDefault();
  const input = document.getElementById("subEmail");
  const btn = form.querySelector("button");
  const email = input.value.trim();
  if (!email) return;
  if (!isAiesecEmail(email)){
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "Use your AIESEC email, like name@aiesec.net.";
    return;
  }

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Saving…";
  msg.className = "form__msg";

  try{
    const res = await subscribeEmail(email);
    msg.className = "form__msg form__msg--ok is-on";
    msg.textContent = res._local
      ? "Saved on this device. Connect Firebase to collect these centrally."
      : "You are on the list.";
    form.reset();
  }catch(err){
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "That did not save. Check the address and try again.";
    console.error(err);
  }finally{
    btn.disabled = false;
    btn.textContent = prev;
  }
});
