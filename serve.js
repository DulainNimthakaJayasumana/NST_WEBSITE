/* ============================================================
   serve.js — zero-dependency local preview server
   ------------------------------------------------------------
   The site uses JavaScript modules, which browsers refuse to load
   from file:// URLs. So open it through a server:

       node serve.js            ->  http://localhost:5179

   Nothing to install. For the real deployment use Firebase
   Hosting (see README.md).
   ============================================================ */

const http = require("http");
const fs   = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 5179;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".mjs":  "text/javascript; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
  ".mp4":  "video/mp4",
  ".m4a":  "audio/mp4",
  ".webm": "video/webm",
  ".woff2":"font/woff2",
  ".txt":  "text/plain; charset=utf-8"
};

http.createServer((req, res) => {
  let rel = decodeURIComponent(req.url.split("?")[0]);
  if (rel === "/") rel = "/index.html";

  const file = path.join(ROOT, path.normalize(rel).replace(/^([/\\])+/, ""));
  if (!file.startsWith(ROOT)){ res.writeHead(403).end("Forbidden"); return; }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()){
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end('<h1 style="font:600 24px system-ui;padding:40px">404 &mdash; not found</h1>');
      return;
    }
    const headers = {
      "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
      // Dev server: never cache, so an edit always shows on refresh.
      // Production caching is set in firebase.json instead.
      "Cache-Control": "no-store, max-age=0",
      "Accept-Ranges": "bytes"
    };
    // Media players seek with Range requests; the soundtrack's page-to-page
    // resume depends on it.
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || "");
    if (m && (m[1] || m[2])){
      const start = m[1] ? Number(m[1]) : Math.max(0, st.size - Number(m[2]));
      const end = m[1] && m[2] ? Math.min(Number(m[2]), st.size - 1) : st.size - 1;
      if (start >= st.size || start > end){
        res.writeHead(416, { "Content-Range": `bytes */${st.size}` }).end();
        return;
      }
      res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${st.size}`, "Content-Length": end - start + 1 });
      fs.createReadStream(file, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, { ...headers, "Content-Length": st.size });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => {
  console.log(`NextGen Storytellers 2.0 -> http://localhost:${PORT}`);
});
