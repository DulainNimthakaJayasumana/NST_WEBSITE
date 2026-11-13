/* ============================================================
   qr.js: draw the QR on a pass, and read one with the camera
   ------------------------------------------------------------
   Both libraries load from jsDelivr only when they are needed, so
   pages without a pass or a scanner never download them.
     • qrcode-generator (MIT, Kazuhiko Arase) draws the code
     • jsQR (Apache-2.0) reads it where the browser has no
       built-in BarcodeDetector (Safari, Firefox)
   ============================================================ */

const GEN_SRC  = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
const READ_SRC = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js";

const loading = {};
function loadScript(src, globalName){
  if (window[globalName]) return Promise.resolve(window[globalName]);
  if (!loading[src]){
    loading[src] = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload  = () => window[globalName] ? resolve(window[globalName]) : reject(new Error(`${globalName} missing`));
      s.onerror = () => { delete loading[src]; reject(new Error(`Could not load ${src}`)); };
      document.head.appendChild(s);
    });
  }
  return loading[src];
}

/* What a pass QR says: NGS|<ref>|<email>. The email is what attendance is
   keyed on; the ref is a second way to find the person. */
export const passCode = p => `NGS|${p.ref}|${String(p.email || "").toLowerCase()}`;

/* Accepts a scanned QR, a typed reference (NGS-ABC123) or a typed email. */
export function parseCode(text){
  const t = String(text || "").trim();
  if (!t) return null;
  const m = t.match(/^NGS\|([A-Z0-9-]+)\|(\S+@\S+)$/i);
  if (m) return { ref: m[1].toUpperCase(), email: m[2].toLowerCase() };
  if (/^\S+@\S+\.\S+$/.test(t)) return { email: t.toLowerCase() };
  const r = t.toUpperCase().replace(/\s+/g, "").match(/^(?:NGS-?)?([A-Z0-9]{6})$/);
  if (r) return { ref: `NGS-${r[1]}` };
  return null;
}

/* An SVG string, dark modules on a white quiet zone so phones read it off a screen. */
export async function qrSvg(text, { label = "QR code" } = {}){
  const qrcode = await loadScript(GEN_SRC, "qrcode");
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const n = q.getModuleCount(), m = 3, size = n + m * 2;
  let d = "";
  for (let r = 0; r < n; r++){
    for (let c = 0; c < n; c++){
      if (q.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    }
  }
  return `<svg viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="${label}">` +
         `<rect width="${size}" height="${size}" fill="#fff"/><path d="${d}" fill="#05020e"/></svg>`;
}

/* Starts the camera in <video> and calls onCode(text) for each QR it sees.
   Resolves to a stop() function. Rejects if there is no camera or the
   person said no. */
export async function startScanner(video, onCode){
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot use the camera here. Open the admin page over https.");
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false
  });
  video.srcObject = stream;
  video.setAttribute("playsinline", "");
  video.muted = true;
  await video.play().catch(() => {});

  let detect;
  let native = null;
  try{
    if ("BarcodeDetector" in window){
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) native = new window.BarcodeDetector({ formats: ["qr_code"] });
    }
  }catch{ native = null; }

  if (native){
    detect = async () => (await native.detect(video))[0]?.rawValue || "";
  }else{
    const jsQR = await loadScript(READ_SRC, "jsQR");
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    detect = async () => {
      const w = video.videoWidth, h = video.videoHeight;
      if (!w || !h) return "";
      const scale = Math.min(1, 720 / Math.max(w, h));       // smaller frame, faster decode
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" })?.data || "";
    };
  }

  let running = true;
  let timer = 0;
  const loop = async () => {
    if (!running) return;
    try{
      const text = video.readyState >= 2 ? await detect() : "";
      if (text && running) onCode(text);
    }catch{ /* a bad frame; keep going */ }
    if (running) timer = setTimeout(loop, 140);
  };
  loop();

  return () => {
    running = false;
    clearTimeout(timer);
    stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
  };
}
