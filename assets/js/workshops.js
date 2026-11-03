/* ============================================================
   workshops.js — workshops.html
   ============================================================ */

import { MODULES, AGENDA, CLUSTERS } from "./data.js";
import { mountChrome, liveWatch, initReveal, esc, statusOf } from "./ui.js";
import { renderWorkshops, renderAgenda } from "./cards.js";

mountChrome({ active: "workshops.html" });

/* ---------- list + filters ---------- */
const grid = document.getElementById("grid");
let all = [];
let filter = "all";

function apply(){
  const now = new Date();
  const list = all.filter(w => {
    if (filter === "all") return true;
    if (filter === "upcoming") return statusOf(w, now) !== "done";
    return w.type === filter;
  });
  renderWorkshops(grid, list, { allOpen: true });
}

document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => {
      b.classList.toggle("is-on", b === btn);
      b.setAttribute("aria-selected", String(b === btn));
    });
    filter = btn.dataset.filter;
    apply();
  });
});

liveWatch.onData(w => { all = w.workshops; apply(); });

/* ---------- modules ---------- */
const modEl = document.getElementById("modules-grid");
if (modEl){
  modEl.innerHTML = MODULES.map((m, i) => `
    <div class="module reveal" data-d="${i + 1}">
      <h3>${esc(m.title)}</h3>
      <p>${esc(m.full)}. ${esc(m.covers)}.</p>
      <div class="wmeta">
        <div class="wmeta__row">
          <span class="wmeta__k">Led by</span>
          <span class="wmeta__v">${esc(m.facilitators.join(", "))}</span>
        </div>
      </div>
    </div>`).join("");
  initReveal(modEl);
}

/* ---------- agenda ---------- */
renderAgenda(document.getElementById("agenda-list"), AGENDA);

/* ---------- clusters ---------- */
const clusters = document.getElementById("clusters");
if (clusters){
  clusters.innerHTML = CLUSTERS.map((k, i) => `
    <div class="cluster reveal" data-d="${i + 1}">
      <h3>${esc(k.city)}</h3>
      <p class="cluster__date">${esc(k.dateLabel)}</p>
      <ul>${k.entities.map(e => `<li>${esc(e)}</li>`).join("")}</ul>
    </div>`).join("");
  initReveal(clusters);
}
