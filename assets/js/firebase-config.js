/* ============================================================
   firebase-config.js
   ------------------------------------------------------------
   PASTE YOUR FIREBASE WEB CONFIG HERE.

   Firebase console -> Project settings -> General ->
   "Your apps" -> Web app -> SDK setup and configuration -> Config

   Until you replace these placeholders the whole site still works:
   it falls back to the seed content in data.js and keeps
   registrations in the browser. Nothing breaks, nothing is lost —
   you just will not have a shared database yet.
   ============================================================ */
export const firebaseConfig = {
  apiKey: "AIzaSyBdd2cdc29zb_5QtppOd_dW2fA946Rx6cw",
  authDomain: "nst-nextgen-storytellers.firebaseapp.com",
  projectId: "nst-nextgen-storytellers",
  storageBucket: "nst-nextgen-storytellers.firebasestorage.app",
  messagingSenderId: "927521730184",
  appId: "1:927521730184:web:eb5ef1469af1ef3167b93d",
  measurementId: "G-ZKWC66L2Y9"
};

/* The Firebase JS SDK version loaded from Google's CDN. */
export const SDK_VERSION = "11.0.2";

/* Collection / document names. Change only if you rename them in Firestore. */
export const PATHS = {
  workshops:     "workshops",
  registrations: "registrations",
  messages:      "messages",
  subscribers:   "subscribers",
  settingsDoc:   "settings/live"
};

/* A very small gate for the admin page. This is convenience, NOT security —
   real protection comes from firestore.rules. See README.md. */
export const ADMIN_PASSPHRASE = "showcase2026";

/* True once the placeholders above have been replaced. */
export function isConfigured(){
  return Object.values(firebaseConfig).every(
    v => typeof v === "string" && v.length > 0 && !v.startsWith("PASTE_")
  );
}
