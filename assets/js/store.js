/* ============================================================
   store.js — the one place the site talks to data.
   ------------------------------------------------------------
   Two modes, same API:

   • CLOUD  — Firebase is configured, so workshops and the live
              switch stream from Firestore in real time. Flip a
              session live in /admin.html and every open tab
              shows the "HAPPENING NOW" screen within a second.

   • LOCAL  — Firebase is not configured (or the CDN is blocked).
              Seed content from data.js is used and registrations
              are kept in localStorage so the site is still fully
              clickable. A banner on the admin page says so.
   ============================================================ */

import { firebaseConfig, SDK_VERSION, PATHS, isConfigured } from "./firebase-config.js";
import { WORKSHOPS as SEED_WORKSHOPS } from "./data.js";

const LS_REGS = "nst2:registrations";
const LS_MSGS = "nst2:messages";
const LS_SUBS = "nst2:subscribers";
const LS_LIVE = "nst2:live";

let fb = null;             // { app, db, api }
let mode = "local";
let readyPromise = null;

/* ---------- boot ---------- */
export function ready(){
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    if (!isConfigured()) { mode = "local"; return mode; }
    try{
      const base = `https://www.gstatic.com/firebasejs/${SDK_VERSION}`;
      const [appMod, fsMod, authMod] = await Promise.all([
        import(`${base}/firebase-app.js`),
        import(`${base}/firebase-firestore.js`),
        import(`${base}/firebase-auth.js`)
      ]);
      const app  = appMod.initializeApp(firebaseConfig);
      const db   = fsMod.getFirestore(app);
      const auth = authMod.getAuth(app);
      fb = { app, db, auth, api: fsMod, authApi: authMod };
      mode = "cloud";
    }catch(err){
      console.warn("[NST] Firebase unavailable, falling back to local mode:", err);
      mode = "local";
    }
    return mode;
  })();
  return readyPromise;
}

export function getMode(){ return mode; }
export async function getModeAsync(){ await ready(); return mode; }

/* ---------- team sign-in (admin page only) ----------
   In cloud mode this is a real Firebase Auth account, which is what
   firestore.rules checks. In local mode there is nothing to protect,
   so the admin page falls back to its passphrase. */
export async function signIn(email, password){
  await ready();
  if (mode !== "cloud") throw new Error("Firebase is not connected.");
  const { signInWithEmailAndPassword } = fb.authApi;
  const cred = await signInWithEmailAndPassword(fb.auth, email, password);
  return cred.user;
}

export async function signOutTeam(){
  await ready();
  if (mode !== "cloud") return;
  await fb.authApi.signOut(fb.auth);
}

export function onAuth(cb){
  let stop = () => {};
  ready().then(() => {
    if (mode !== "cloud"){ cb(null); return; }
    stop = fb.authApi.onAuthStateChanged(fb.auth, cb);
  });
  return () => stop();
}

export function currentUser(){
  return fb?.auth?.currentUser || null;
}

/* ---------- helpers ---------- */
function toDate(v){
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();          // Firestore Timestamp
  if (typeof v === "number") return new Date(v);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function normalise(w){
  const start = toDate(w.startAt);
  const end   = toDate(w.endAt) || (start ? new Date(start.getTime() + 2 * 3600e3) : null);
  return {
    ...w,
    startAt: start,
    endAt: end,
    facilitators: w.facilitators || [],
    tools: w.tools || [],
    resources: w.resources || [],
    entities: w.entities || [],
    registrationOpen: w.registrationOpen !== false,
    capacity: Number.isFinite(w.capacity) ? w.capacity : null
  };
}

function sortByStart(list){
  return [...list].sort((a, b) => (a.startAt?.getTime() || 0) - (b.startAt?.getTime() || 0));
}

const seedNormalised = () => sortByStart(SEED_WORKSHOPS.map(normalise));

/* Merge a Firestore doc over its seed twin so a half-filled doc
   (e.g. only joinUrl set) still shows the full session details. */
function mergeOverSeed(docs){
  const seedById = new Map(SEED_WORKSHOPS.map(w => [w.id, w]));
  const out = [];
  const seen = new Set();
  for (const d of docs){
    const seed = seedById.get(d.id) || {};
    const merged = { ...seed, ...stripEmpty(d) };
    out.push(normalise(merged));
    seen.add(d.id);
  }
  for (const [id, seed] of seedById) if (!seen.has(id)) out.push(normalise(seed));
  return sortByStart(out);
}

/* Firestore fields that are null/"" should not wipe good seed values. */
function stripEmpty(obj){
  const o = {};
  for (const [k, v] of Object.entries(obj)){
    if (v === null || v === undefined) continue;
    if (typeof v === "string" && v.trim() === "" && k !== "joinUrl") continue;
    o[k] = v;
  }
  return o;
}

/* ---------- workshops ---------- */
export async function getWorkshops(){
  await ready();
  if (mode !== "cloud") return seedNormalised();
  try{
    const { collection, getDocs } = fb.api;
    const snap = await getDocs(collection(fb.db, PATHS.workshops));
    return mergeOverSeed(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  }catch(err){
    console.warn("[NST] getWorkshops failed, using seed:", err);
    return seedNormalised();
  }
}

/* Live subscription. Returns an unsubscribe function. */
export function onWorkshops(cb){
  let stop = () => {};
  ready().then(() => {
    if (mode !== "cloud"){ cb(seedNormalised()); return; }
    try{
      const { collection, onSnapshot } = fb.api;
      stop = onSnapshot(
        collection(fb.db, PATHS.workshops),
        snap => cb(mergeOverSeed(snap.docs.map(d => ({ id: d.id, ...d.data() })))),
        err => { console.warn("[NST] workshops stream error:", err); cb(seedNormalised()); }
      );
    }catch(err){
      console.warn("[NST] workshops subscribe failed:", err);
      cb(seedNormalised());
    }
  });
  return () => stop();
}

export async function saveWorkshop(id, patch){
  await ready();
  if (mode !== "cloud") throw new Error("Connect Firebase to save workshops.");
  const { doc, setDoc } = fb.api;
  await setDoc(doc(fb.db, PATHS.workshops, id), patch, { merge: true });
}

/* ---------- live switch ---------- */
const DEFAULT_LIVE = { mode: "auto", workshopId: "", message: "", joinUrl: "" };

export function onLiveSettings(cb){
  let stop = () => {};
  ready().then(() => {
    if (mode !== "cloud"){
      cb(readLocalLive());
      // keep tabs on this device in sync too
      const h = e => { if (e.key === LS_LIVE) cb(readLocalLive()); };
      window.addEventListener("storage", h);
      stop = () => window.removeEventListener("storage", h);
      return;
    }
    try{
      const { doc, onSnapshot } = fb.api;
      const [col, id] = PATHS.settingsDoc.split("/");
      stop = onSnapshot(
        doc(fb.db, col, id),
        snap => cb({ ...DEFAULT_LIVE, ...(snap.exists() ? snap.data() : {}) }),
        err => { console.warn("[NST] live stream error:", err); cb(DEFAULT_LIVE); }
      );
    }catch(err){
      console.warn("[NST] live subscribe failed:", err);
      cb(DEFAULT_LIVE);
    }
  });
  return () => stop();
}

export async function setLiveSettings(patch){
  await ready();
  if (mode !== "cloud"){ writeLocalLive(patch); return; }
  const { doc, setDoc } = fb.api;
  const [col, id] = PATHS.settingsDoc.split("/");
  await setDoc(doc(fb.db, col, id), patch, { merge: true });
}

function readLocalLive(){
  try{ return { ...DEFAULT_LIVE, ...JSON.parse(localStorage.getItem(LS_LIVE) || "{}") }; }
  catch{ return { ...DEFAULT_LIVE }; }
}
function writeLocalLive(patch){
  const next = { ...readLocalLive(), ...patch };
  try{ localStorage.setItem(LS_LIVE, JSON.stringify(next)); }catch{}
  window.dispatchEvent(new StorageEvent("storage", { key: LS_LIVE }));
}

/* ---------- registrations ---------- */
export function makeRef(){
  const s = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += s[Math.floor(Math.random() * s.length)];
  return `NGS-${out}`;
}

export async function register(payload){
  await ready();
  const record = { ...payload, ref: makeRef(), createdAt: new Date().toISOString() };

  if (mode !== "cloud"){
    const all = lsRead(LS_REGS);
    all.push(record);
    lsWrite(LS_REGS, all);
    return { ...record, _local: true };
  }

  const { collection, addDoc, serverTimestamp } = fb.api;
  await addDoc(collection(fb.db, PATHS.registrations), {
    ...payload,
    ref: record.ref,
    createdAt: serverTimestamp()
  });
  return record;
}

export async function listRegistrations(){
  await ready();
  if (mode !== "cloud") return lsRead(LS_REGS).map(r => ({ ...r, _local: true }));
  const { collection, getDocs, query, orderBy } = fb.api;
  try{
    const snap = await getDocs(query(collection(fb.db, PATHS.registrations), orderBy("createdAt", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
  }catch{
    const snap = await getDocs(collection(fb.db, PATHS.registrations));
    return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
  }
}

export async function countRegistrations(workshopId){
  const all = await listRegistrations();
  return all.filter(r => r.workshopId === workshopId).length;
}

/* ---------- contact messages & mailing list ---------- */
export async function sendMessage(payload){
  await ready();
  if (mode !== "cloud"){
    const all = lsRead(LS_MSGS); all.push({ ...payload, createdAt: new Date().toISOString() }); lsWrite(LS_MSGS, all);
    return { _local: true };
  }
  const { collection, addDoc, serverTimestamp } = fb.api;
  await addDoc(collection(fb.db, PATHS.messages), { ...payload, createdAt: serverTimestamp() });
  return {};
}

export async function subscribeEmail(email){
  await ready();
  const clean = String(email || "").trim().toLowerCase();
  if (!clean) throw new Error("Email required");
  if (mode !== "cloud"){
    const all = lsRead(LS_SUBS);
    if (!all.includes(clean)) all.push(clean);
    lsWrite(LS_SUBS, all);
    return { _local: true };
  }
  const { doc, setDoc, serverTimestamp } = fb.api;
  await setDoc(doc(fb.db, PATHS.subscribers, clean), { email: clean, createdAt: serverTimestamp() }, { merge: true });
  return {};
}

export async function listMessages(){
  await ready();
  if (mode !== "cloud") return lsRead(LS_MSGS);
  const { collection, getDocs } = fb.api;
  const snap = await getDocs(collection(fb.db, PATHS.messages));
  return snap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }));
}

/* ---------- localStorage helpers ---------- */
function lsRead(key){
  try{ return JSON.parse(localStorage.getItem(key) || "[]"); }catch{ return []; }
}
function lsWrite(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); }catch{}
}

export function clearLocalData(){
  [LS_REGS, LS_MSGS, LS_SUBS, LS_LIVE].forEach(k => { try{ localStorage.removeItem(k); }catch{} });
}
