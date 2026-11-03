/* ============================================================
   loader.js — the loading screen
   ------------------------------------------------------------
   Deliberately a plain script in <head>, not a module: it has to
   cover the page before anything else paints. Carries its own CSS
   for the same reason.

   First page of a visit: the Showcase Your Story mark writes itself
   on slowly. Later pages in the same tab: the finished mark, briefly,
   so moving around the site never feels slow.

   >>> To change the pacing, edit FIRST_MS and LATER_MS.
   ============================================================ */
(function () {
  var FIRST_MS = 3200;   // how long the first-visit screen stays, at least
  var LATER_MS = 550;    // same, for every page after that
  var CAP_MS   = 8000;   // never trap anyone behind a stalled download

  var root = document.documentElement;
  var KEY = "nst2:loaded";
  var seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch (e) {}
  var reduced = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var quick = seen || reduced;

  var style = document.createElement("style");
  style.textContent =
    "html.is-loading{overflow:hidden}" +
    "@property --nst-wipe{syntax:'<percentage>';initial-value:0%;inherits:false}" +
    ".nst-loader{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;background:#05020e;" +
      "transition:transform 1s cubic-bezier(.76,0,.24,1)}" +
    ".nst-loader::before{content:'';position:absolute;inset:0;pointer-events:none;" +
      "background:radial-gradient(46vmax 34vmax at 50% 50%,rgba(124,58,237,.22),transparent 70%)}" +
    ".nst-loader.is-out{transform:translateY(-101%)}" +
    ".nst-loader img{position:relative;width:min(62vw,52vh,440px);height:auto;opacity:0}" +
    ".nst-loader.is-ready img{opacity:1;" +
      "-webkit-mask-image:linear-gradient(158deg,#000 calc(var(--nst-wipe) - 16%),transparent var(--nst-wipe));" +
      "mask-image:linear-gradient(158deg,#000 calc(var(--nst-wipe) - 16%),transparent var(--nst-wipe));" +
      "animation:nstWrite 2.7s cubic-bezier(.45,.05,.3,1) forwards,nstBreathe 3.6s ease-in-out infinite}" +
    ".nst-loader--quick.is-ready img{-webkit-mask-image:none;mask-image:none;animation:nstFade .35s ease both}" +
    "@keyframes nstWrite{to{--nst-wipe:120%}}" +
    "@keyframes nstBreathe{0%,100%{filter:drop-shadow(0 0 14px rgba(168,85,247,.35))}50%{filter:drop-shadow(0 0 40px rgba(168,85,247,.8))}}" +
    "@keyframes nstFade{from{opacity:0}to{opacity:1}}";
  document.head.appendChild(style);

  var el = document.createElement("div");
  el.className = "nst-loader" + (quick ? " nst-loader--quick" : "");
  el.setAttribute("aria-hidden", "true");
  var img = new Image();
  img.alt = "";
  img.onload = function () { el.classList.add("is-ready"); };
  img.src = "assets/img/showcase-your-story-white.png";
  el.appendChild(img);

  root.classList.add("is-loading");
  root.appendChild(el);   // <body> does not exist yet; <html> can hold it

  var started = Date.now();
  var done = false;
  function finish() {
    if (done) return;
    done = true;
    el.classList.add("is-out");
    root.classList.remove("is-loading");   // the page's entrance animation keys off this
    window.dispatchEvent(new Event("nst:loaded"));
    try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
    setTimeout(function () { el.remove(); }, 1100);
  }
  function whenReady() {
    var wait = Math.max(0, (quick ? LATER_MS : FIRST_MS) - (Date.now() - started));
    setTimeout(finish, wait);
  }
  function fontsThenReady() {
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(whenReady, whenReady);
    else whenReady();
  }
  if (document.readyState === "complete") fontsThenReady();
  else window.addEventListener("load", fontsThenReady);
  setTimeout(finish, CAP_MS);
})();
