/* ============================================================
   home.js — index.html
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

function playRecap(){
  if (!recapVideo) return;
  recapVideo.controls = true;
  recapCard?.classList.add("is-playing");
  recapVideo.play().catch(() => {
    // Autoplay blocked: the controls are showing, so the viewer can start it.
    recapCard?.classList.add("is-playing");
  });
  recapCard?.scrollIntoView({ block: "center", behavior: "smooth" });
}

document.getElementById("recapPlay")?.addEventListener("click", playRecap);
document.getElementById("recapBtn")?.addEventListener("click", playRecap);

/* The recap has its own audio, so the soundtrack steps aside while it runs
   and comes back when it stops. Paired strictly one-for-one. */
let ducked = false;
const duck   = () => { if (!ducked){ ducked = true;  sound.duck(); } };
const unduck = () => { if (ducked) { ducked = false; sound.unduck(); } };

recapVideo?.addEventListener("play",  duck);
recapVideo?.addEventListener("pause", unduck);
recapVideo?.addEventListener("ended", () => {
  unduck();
  recapCard?.classList.remove("is-playing");
  recapVideo.controls = false;
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
