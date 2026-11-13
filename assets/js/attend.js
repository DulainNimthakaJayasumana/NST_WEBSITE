/* ============================================================
   attend.js: attend.html?w=<workshopId>
   ------------------------------------------------------------
   The online check-in link. It only works while the team has the
   session's check-in window open (set on the admin page), and
   firestore.rules checks that too, so the page cannot be tricked.
   ============================================================ */

import { mountChrome, liveWatch, esc, fmt, isAiesecEmail } from "./ui.js";
import { selfCheckIn, checkInOpen } from "./store.js";

mountChrome({ active: "", takeover: false });

const id = new URLSearchParams(location.search).get("w") || "";
const form   = document.getElementById("attForm");
const input  = document.getElementById("attEmail");
const msg    = document.getElementById("attMsg");
const btn    = document.getElementById("attBtn");
const state  = document.getElementById("attOpenState");
const done   = document.getElementById("attDone");
const pick   = document.getElementById("attPick");

let session = null;
let finished = false;
let lastKey = "";

function paint(watch){
  const list = watch.workshops;
  session = list.find(w => w.id === id) || null;

  if (!session){
    document.getElementById("attTitle").textContent = "Check in";
    document.getElementById("attWhen").textContent = id
      ? "That check-in link does not match a session. Ask the team for the right one."
      : "Use the check-in link the team shares during the session.";
    setState(false, "No session picked");
    form.hidden = true;
    const open = list.filter(w => checkInOpen(w));
    pick.hidden = !open.length;
    pick.innerHTML = open.map(w =>
      `<a href="attend.html?w=${encodeURIComponent(w.id)}"><b>${esc(w.title)}</b><span>Check-in open &rarr;</span></a>`).join("");
    return;
  }

  pick.hidden = true;
  document.getElementById("attTitle").textContent = session.title;
  document.getElementById("attWhen").textContent = session.startAt
    ? fmt.range(session.startAt, session.endAt) : "";
  document.title = `Check in: ${session.title} | NextGen Storytellers 2.0`;

  const now = new Date();
  const open = checkInOpen(session, now);
  if (open){
    const left = Math.max(0, Math.ceil((session.attendUntil - now) / 60000));
    setState(true, `Check-in is open until ${fmt.time(session.attendUntil)} (${left} min left)`);
  }else if (session.attendFrom && session.attendFrom > now){
    setState(false, `Check-in opens at ${fmt.time(session.attendFrom)}`);
  }else{
    setState(false, "Check-in is closed. The team opens it during the session.");
  }
  if (!finished) form.hidden = !open;
}

function setState(open, text){
  const key = `${open}|${text}`;
  if (key === lastKey) return;
  lastKey = key;
  state.classList.toggle("is-open", open);
  state.querySelector("span").textContent = text;
}

liveWatch.on(paint);

input.addEventListener("input", () => input.closest(".field")?.classList.remove("has-err"));

const MESSAGES = {
  closed: "Check-in just closed for this session. If you were there, message the team from the contact page.",
  "not-registered": "We could not find a registration for that email. Check the spelling. If you joined without registering, tell the team in the meeting chat.",
  "not-this-session": "That email is registered, but not for this session. Check you opened the right link."
};

form.addEventListener("submit", async e => {
  e.preventDefault();
  msg.className = "form__msg";
  if (!isAiesecEmail(input.value)){
    input.closest(".field")?.classList.add("has-err");
    return;
  }
  if (!session) return;
  btn.disabled = true;
  btn.textContent = "Marking…";
  try{
    const res = await selfCheckIn(session, input.value);
    if (res.status === "ok" || res.status === "already"){
      finished = true;
      form.hidden = true;
      done.hidden = false;
      const first = (res.pass?.name || "").split(" ")[0];
      done.innerHTML = `<div class="attend__done">
        <h3>${res.status === "ok" ? "You're marked present" : "Already checked in"}</h3>
        <p>${esc(first ? `Thanks, ${first}. ` : "")}${esc(session.title)}${res.at ? `, ${esc(fmt.time(res.at))}` : ""}.
           ${res.status === "already" ? "Your attendance was already saved, nothing more to do." : "That is all you need to do."}</p>
      </div>`;
      return;
    }
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = MESSAGES[res.status] || "That did not work. Try again.";
  }catch(err){
    console.error(err);
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "Could not save that. Check your connection and try again.";
  }finally{
    btn.disabled = false;
    btn.textContent = "Mark my attendance";
  }
});
