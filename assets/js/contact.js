/* ============================================================
   contact.js — contact.html
   ============================================================ */

import { SERIES, LEAD, MANAGERS } from "./data.js";
import { mountChrome, initReveal, esc, icon, initials } from "./ui.js";
import { sendMessage, getMode } from "./store.js";

mountChrome({ active: "contact.html" });

const person = (name, role, photo) => `
  <figure class="person reveal">
    <div class="person__img">${photo
      ? `<img src="${esc(photo)}" alt="${esc(name)}, ${esc(role)}" loading="lazy">`
      : `<div class="person__mono" aria-hidden="true">${esc(initials(name))}</div>`}</div>
    <figcaption><b>${esc(name)}</b><span>${esc(role)}</span></figcaption>
  </figure>`;

/* ---------- tier 1: MCVP ---------- */
const lead = document.getElementById("orgLead");
if (lead){
  lead.innerHTML = person(LEAD.name, LEAD.role, LEAD.photo);
  initReveal(lead);
}

/* ---------- tier 2: managers ---------- */
const mgr = document.getElementById("orgManagers");
if (mgr){
  mgr.innerHTML = MANAGERS.map(m => person(m.name, m.role, m.photo)).join("");
  initReveal(mgr);
}

/* ---------- links ---------- */
const c = SERIES.contact;
const linkDefs = [
  c.email     && { ic: "mail",      t: "Email",              v: c.email,                href: `mailto:${c.email}` },
  c.phone     && { ic: "phone",     t: "Call or WhatsApp",   v: c.phone,                href: `tel:${c.phone.replace(/\s/g, "")}` },
  c.instagram && { ic: "instagram", t: "Instagram",          v: "Follow the team",      href: c.instagram, ext: true },
  c.tiktok    && { ic: "tiktok",    t: "TikTok",             v: "See what we post",     href: c.tiktok, ext: true },
  c.facebook  && { ic: "facebook",  t: "Facebook",           v: "Page",                 href: c.facebook, ext: true },
  c.linkedin  && { ic: "linkedin",  t: "LinkedIn",           v: "Page",                 href: c.linkedin, ext: true },
  c.aiesec    && { ic: "globe",     t: "AIESEC in Sri Lanka",v: "aiesec.lk",            href: c.aiesec, ext: true }
].filter(Boolean);

const links = document.getElementById("links");
if (links){
  links.innerHTML = linkDefs.map(l => `
    <a class="clink" href="${esc(l.href)}"${l.ext ? ' target="_blank" rel="noopener"' : ""}>
      <span class="clink__ico">${icon(l.ic)}</span>
      <span class="clink__txt"><b>${esc(l.t)}</b><span>${esc(l.v)}</span></span>
    </a>`).join("");

  if (!c.email && !c.phone){
    links.insertAdjacentHTML("beforeend", `
      <p class="field__hint" style="padding:4px 2px">
        Add your email, phone and Instagram in
        <code style="font-family:var(--f-mono)">assets/js/data.js</code> and they appear here.
      </p>`);
  }
}

/* ---------- message form ---------- */
const form = document.getElementById("msgForm");
const msg  = document.getElementById("cMsg");
const btn  = document.getElementById("cSubmit");

function mark(el, bad){ el.closest(".field")?.classList.toggle("has-err", bad); return !bad; }

["cName", "cEmail", "cBody"].forEach(id =>
  document.getElementById(id)?.addEventListener("input", e =>
    e.target.closest(".field")?.classList.remove("has-err")));

form?.addEventListener("submit", async e => {
  e.preventDefault();
  const name  = document.getElementById("cName");
  const email = document.getElementById("cEmail");
  const body  = document.getElementById("cBody");

  let ok = mark(name, !name.value.trim());
  ok = mark(email, !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) && ok;
  ok = mark(body, body.value.trim().length < 5) && ok;
  if (!ok) return;

  btn.disabled = true;
  const prev = btn.textContent;
  btn.textContent = "Sending…";
  msg.className = "form__msg";

  try{
    const res = await sendMessage({
      name:    name.value.trim(),
      email:   email.value.trim().toLowerCase(),
      subject: document.getElementById("cSubject").value,
      body:    body.value.trim()
    });
    msg.className = "form__msg form__msg--ok is-on";
    msg.textContent = (res._local || getMode() !== "cloud")
      ? "Saved on this device. Connect Firebase so messages reach the team inbox."
      : "Message sent — we usually reply within a day or two.";
    form.reset();
  }catch(err){
    console.error(err);
    msg.className = "form__msg form__msg--err is-on";
    msg.textContent = "That did not send. Try again, or reach us on social instead.";
  }finally{
    btn.disabled = false;
    btn.textContent = prev;
  }
});
