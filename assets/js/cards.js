/* ============================================================
   cards.js — line-up rows, road map and the other home blocks
   shared by index.html and workshops.html
   ============================================================ */

import { SERIES, CLUSTERS } from "./data.js";
import { esc, fmt, statusOf, initReveal, icon } from "./ui.js";

/* ---------- status, as a plain label ---------- */
function statusLabel(w, now){
  const st = statusOf(w, now);
  if (st === "live") return `<span class="badge badge--live"><i class="dot dot--pulse"></i> Live now</span>`;
  if (st === "done") return `<span class="badge badge--done">Completed</span>`;
  return w.type === "online"
    ? `<span class="badge badge--online"><i class="dot"></i> Online</span>`
    : `<span class="badge badge--physical"><i class="dot"></i> Physical</span>`;
}

/* ---------- one row of the line-up ---------- */
export function sessionRow(w, i, { open = false } = {}){
  const now = new Date();
  const st = statusOf(w, now);
  const online = w.type === "online";
  const join = w.joinUrl || "";
  const n = String(i + 1).padStart(2, "0");

  const when = w.dateConfirmed === false && w.dateNote
    ? w.dateNote.split(" — ")[0].replace(/ 20\d\d$/, "")
    : `${fmt.short(w.startAt)} · ${fmt.time(w.startAt)}`;

  const cta = st === "live" && join
    ? `<a class="btn btn--live btn--sm" href="${esc(join)}" target="_blank" rel="noopener">Join now</a>`
    : st === "done"
      ? `<span class="srow__wait">Session wrapped</span>`
      : `<a class="btn btn--sm" href="register.html?w=${encodeURIComponent(w.id)}">Register</a>
         ${online && join ? `<a class="btn btn--ghost btn--sm" href="${esc(join)}" target="_blank" rel="noopener">Meeting link</a>` : ""}`;

  const row = (k, v) => v ? `<div class="wmeta__row"><span class="wmeta__k">${k}</span><span class="wmeta__v">${esc(v)}</span></div>` : "";

  return `
  <article class="srow ${open ? "is-open" : ""} reveal" data-type="${esc(w.type)}" data-id="${esc(w.id)}">
    <button class="srow__head" type="button" aria-expanded="${open}" aria-controls="srow-${esc(w.id)}" data-cursor="Details">
      <span class="srow__n">${n}</span>
      <span class="srow__title">${esc(w.title)}</span>
      <span class="srow__when">${esc(when)}</span>
      ${statusLabel(w, now)}
      <span class="srow__tog" aria-hidden="true"></span>
    </button>
    <div class="srow__body" id="srow-${esc(w.id)}">
      <div class="srow__in">
        <div class="srow__grid">
          <div>
            <p class="srow__desc">${esc(w.desc || "")}</p>
            ${w.dateConfirmed === false ? `<p class="srow__note">${esc(w.dateNote || "Provisional date — confirmation coming soon.")}</p>` : ""}
            <div class="btn-row srow__cta">${cta}</div>
          </div>
          <div class="wmeta">
            ${row("Led by", (w.facilitators || []).join(", "))}
            ${row("Runs for", w.durationLabel)}
            ${row(online ? "Where" : "Venue", online ? (w.platform || "Online") : (w.venue || "To be announced"))}
            ${row("Bring / use", (w.tools || []).join(", "))}
            ${row("Resources", (w.resources || []).join(", "))}
          </div>
        </div>
      </div>
    </div>
  </article>`;
}

/* ---------- the whole list ---------- */
export function renderWorkshops(el, list, opts = {}){
  if (!el) return;
  if (!list.length){
    el.innerHTML = `<div class="empty"><p>No sessions match this filter yet.</p></div>`;
    return;
  }
  el.innerHTML = list.map((w, i) => sessionRow(w, i, { open: opts.allOpen || (!opts.noneOpen && i === 0) })).join("");

  if (!el.dataset.bound){
    el.dataset.bound = "1";
    el.addEventListener("click", e => {
      const head = e.target.closest(".srow__head");
      if (!head) return;
      const row = head.closest(".srow");
      const open = row.classList.toggle("is-open");
      head.setAttribute("aria-expanded", String(open));
    });
  }
  initReveal(el);
}

/* ---------- road map: every workshop day, in order ---------- */
const fStop = new Intl.DateTimeFormat("en-GB", { timeZone: SERIES.timezone, weekday: "short", day: "numeric", month: "short" });

export function renderPhases(el, workshops, now = new Date()){
  if (!el) return;
  const list = [...workshops].filter(w => w.startAt).sort((a, b) => a.startAt - b.startAt);
  el.innerHTML = list.map(w => {
    const live = statusOf(w, now) === "live";
    const done = statusOf(w, now) === "done";
    const status = live ? "On now" : done ? "Done" : w.dateConfirmed === false ? "Date to be confirmed" : "";
    const online = w.type === "online";
    const cluster = CLUSTERS.find(k => w.id.startsWith(k.id));
    return `
    <div class="phase ${live ? "is-active" : done ? "is-done" : ""}">
      <span class="phase__status">${esc(status)}</span>
      <div class="phase__date">${esc(fStop.format(w.startAt))}</div>
      <h4>${esc(w.title)}</h4>
      <p>${esc(fmt.time(w.startAt))} – ${esc(fmt.time(w.endAt))} · ${esc(online ? (w.platform || "Online") : (w.venue || "Venue to be announced"))}</p>
      ${cluster ? `<p class="phase__ents">${esc(cluster.entities.join(" · "))}</p>` : ""}
    </div>`;
  }).join("");
}

/* ---------- agenda ---------- */
export function renderAgenda(el, rows){
  if (!el) return;
  el.innerHTML = rows.map(r => `
    <div class="agenda__row ${r.kind === "break" ? "agenda__row--break" : ""} reveal">
      <span class="agenda__time">${esc(r.time)}</span>
      <span class="agenda__what">${esc(r.what)}</span>
    </div>`).join("");
  initReveal(el);
}

/* ---------- outcomes ---------- */
export function renderOutcomes(el, items){
  if (!el) return;
  el.innerHTML = items.map((o, i) => `
    <div class="oc reveal" data-d="${(i % 4) + 1}">
      <span class="oc__n">${String(i + 1).padStart(2, "0")}</span>
      <h3>${esc(o.title)}</h3>
      <p>${esc(o.text)}</p>
    </div>`).join("");
  initReveal(el);
}

/* ---------- FAQ accordion ---------- */
export function renderFaq(el, items){
  if (!el || !items?.length) return;
  el.innerHTML = items.map((f, i) => `
    <div class="faq__item reveal">
      <h3 class="faq__h">
        <button class="faq__q" type="button" id="faqQ${i}" aria-expanded="false" aria-controls="faqA${i}">
          <span class="faq__num">${String(i + 1).padStart(2, "0")}</span>
          <span class="faq__txt">${esc(f.q)}</span>
          <span class="faq__tog" aria-hidden="true"></span>
        </button>
      </h3>
      <div class="faq__a" id="faqA${i}">
        <div class="faq__a-in"><p>${esc(f.a)}</p></div>
      </div>
    </div>`).join("");

  const rows = [...el.querySelectorAll(".faq__item")];
  const setOpen = (row, open) => {
    row.classList.toggle("is-open", open);
    row.querySelector(".faq__q").setAttribute("aria-expanded", String(open));
  };

  // One answer open at a time; the first starts open so the list is never blank.
  setOpen(rows[0], true);
  el.addEventListener("click", e => {
    const row = e.target.closest(".faq__q")?.closest(".faq__item");
    if (!row) return;
    const open = !row.classList.contains("is-open");
    rows.forEach(r => setOpen(r, r === row && open));
  });

  // Up / Down / Home / End hop between questions (the ARIA accordion pattern).
  el.addEventListener("keydown", e => {
    const qs = [...el.querySelectorAll(".faq__q")];
    const at = qs.indexOf(document.activeElement);
    if (at < 0) return;
    const to = e.key === "ArrowDown" ? (at + 1) % qs.length
             : e.key === "ArrowUp"   ? (at - 1 + qs.length) % qs.length
             : e.key === "Home"      ? 0
             : e.key === "End"       ? qs.length - 1 : -1;
    if (to < 0) return;
    e.preventDefault();
    qs[to].focus();
  });

  initReveal(el);
}

/* ---------- marquee ---------- */
export function renderMarquee(el, items){
  if (!el) return;
  const row = items.map(x => `<span class="marquee__item">${esc(x)}<i></i></span>`).join("");
  // duplicated once so the -50% translate loops seamlessly
  el.innerHTML = `<div class="marquee__track">${row}${row}</div>`;
}

export { SERIES, icon };
