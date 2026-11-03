/* ============================================================
   starfield.js — the universe layer
   ------------------------------------------------------------
   • parallax star layers that drift with scroll and pointer
   • per-star twinkle
   • shooting stars at random intervals
   • a constellation that draws itself around the cursor
   • a separate warp-speed field for the LIVE takeover

   Everything draws one frame synchronously on init, so the page
   never looks empty if requestAnimationFrame is throttled.
   ============================================================ */

const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const PALETTE = [
  [245, 243, 255],  // white
  [245, 243, 255],
  [245, 243, 255],
  [196, 181, 253],  // lilac
  [168, 85, 247],   // violet
  [255, 211, 110]   // gold
];

function rand(a, b){ return a + Math.random() * (b - a); }
function pick(arr){ return arr[Math.floor(Math.random() * arr.length)]; }

/* ---------------------------------------------------------- */
/*  Main starfield                                             */
/* ---------------------------------------------------------- */
export function initStarfield(canvas, opts = {}){
  const {
    density = 1,
    constellation = true,
    parallax = true
  } = opts;

  const ctx = canvas.getContext("2d", { alpha: true });
  let W = 0, H = 0, dpr = 1;
  let stars = [];
  let shooters = [];
  let raf = 0, t0 = performance.now(), lastNow = t0, running = false;

  const pointer = { x: -9999, y: -9999, nx: 0, ny: 0, active: false };
  let scrollY = window.scrollY || 0;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    // A pane that is still opening can report 0 on every dimension, which would
    // put NaN through the whole field. Clamp so the first frame is always valid.
    W = Math.max(1, canvas.clientWidth  || window.innerWidth  || 1);
    H = Math.max(1, canvas.clientHeight || window.innerHeight || 1);
    canvas.width  = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build(){
    const area = W * H;
    const count = Math.round(Math.min(420, Math.max(90, area / 5200)) * density);
    stars = Array.from({ length: count }, () => {
      const z = rand(0.18, 1);               // depth: small+dim far, big+bright near
      return {
        x: Math.random() * W,
        y: Math.random() * H * 1.25,         // a little taller than the viewport for scroll drift
        z,
        r: rand(0.4, 1.5) * (0.5 + z),
        a: rand(0.25, 0.95) * (0.35 + z * 0.65),
        hue: pick(PALETTE),
        ph: Math.random() * Math.PI * 2,
        tw: rand(0.5, 2.1),
        big: Math.random() < 0.07
      };
    });
  }

  /* Shooting stars are timed in seconds, not frames: on a throttled
     rAF (background tab, embedded pane) frame-counted ones would hang
     around for ten seconds and pile up on screen. */
  const MAX_SHOOTERS = 2;
  function spawnShooter(){
    if (shooters.length >= MAX_SHOOTERS) return;
    const fromLeft = Math.random() < 0.5;
    shooters.push({
      x: fromLeft ? -80 : W + 80,
      y: rand(-0.05, 0.55) * H,
      vx: (fromLeft ? 1 : -1) * rand(450, 780),   // px per second
      vy: rand(160, 310),
      len: rand(90, 210),
      age: 0,
      max: rand(1.1, 1.8)                          // seconds
    });
  }

  function draw(now){
    const t = (now - t0) / 1000;
    // Clamped so a resumed tab does not teleport everything across the screen.
    const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) || 0.016;
    lastNow = now;
    ctx.clearRect(0, 0, W, H);

    const sOff = parallax ? scrollY : 0;

    /* --- stars --- */
    for (const s of stars){
      const px = s.x + (parallax ? pointer.nx * 26 * s.z : 0);
      let   py = s.y - sOff * 0.14 * s.z + (parallax ? pointer.ny * 20 * s.z : 0);

      // wrap vertically so the field never runs out while scrolling
      const span = H * 1.25;
      py = ((py % span) + span) % span;
      if (py > H + 12) continue;

      const tw = REDUCED ? 1 : 0.62 + 0.38 * Math.sin(t * s.tw + s.ph);
      const a = s.a * tw;
      const [r, g, b] = s.hue;

      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;

      if (s.big){
        const grd = ctx.createRadialGradient(px, py, 0, px, py, s.r * 7);
        grd.addColorStop(0,   `rgba(${r},${g},${b},${a * 0.9})`);
        grd.addColorStop(0.4, `rgba(${r},${g},${b},${a * 0.22})`);
        grd.addColorStop(1,   `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(px - s.r * 7, py - s.r * 7, s.r * 14, s.r * 14);
      }

      ctx.beginPath();
      ctx.arc(px, py, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
      ctx.fill();

      s._px = px; s._py = py;   // cached for the constellation pass
    }

    /* --- constellation around the cursor --- */
    if (constellation && pointer.active && !REDUCED){
      const R = 150;
      const near = [];
      for (const s of stars){
        if (s._px == null) continue;
        const dx = s._px - pointer.x, dy = s._py - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < R * R) near.push([s, Math.sqrt(d2)]);
        if (near.length > 26) break;
      }
      ctx.lineWidth = 1;
      for (let i = 0; i < near.length; i++){
        const [s, d] = near[i];
        // thread to the cursor
        ctx.strokeStyle = `rgba(168,85,247,${0.3 * (1 - d / R)})`;
        ctx.beginPath();
        ctx.moveTo(pointer.x, pointer.y);
        ctx.lineTo(s._px, s._py);
        ctx.stroke();
        // and to its neighbours
        for (let j = i + 1; j < near.length; j++){
          const o = near[j][0];
          const ddx = s._px - o._px, ddy = s._py - o._py;
          const dd = Math.hypot(ddx, ddy);
          if (dd < 92){
            ctx.strokeStyle = `rgba(196,181,253,${0.17 * (1 - dd / 92)})`;
            ctx.beginPath();
            ctx.moveTo(s._px, s._py);
            ctx.lineTo(o._px, o._py);
            ctx.stroke();
          }
        }
      }
      // a soft halo under the pointer
      const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, 120);
      halo.addColorStop(0, "rgba(168,85,247,.10)");
      halo.addColorStop(1, "rgba(168,85,247,0)");
      ctx.fillStyle = halo;
      ctx.fillRect(pointer.x - 120, pointer.y - 120, 240, 240);
    }

    /* --- shooting stars --- */
    for (let i = shooters.length - 1; i >= 0; i--){
      const sh = shooters[i];
      sh.x += sh.vx * dt; sh.y += sh.vy * dt; sh.age += dt;
      const fade = 1 - sh.age / sh.max;
      if (fade <= 0 || sh.x < -260 || sh.x > W + 260 || sh.y > H + 160){ shooters.splice(i, 1); continue; }
      const ang = Math.atan2(sh.vy, sh.vx);
      const tx = sh.x - Math.cos(ang) * sh.len;
      const ty = sh.y - Math.sin(ang) * sh.len;
      const g = ctx.createLinearGradient(sh.x, sh.y, tx, ty);
      g.addColorStop(0, `rgba(255,255,255,${0.9 * fade})`);
      g.addColorStop(0.3, `rgba(196,181,253,${0.42 * fade})`);
      g.addColorStop(1, "rgba(168,85,247,0)");
      ctx.strokeStyle = g;
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(sh.x, sh.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(sh.x, sh.y, 1.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.fill();
    }
  }

  function loop(now){
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  /* --- events --- */
  const onScroll = () => { scrollY = window.scrollY || 0; };
  const onMove = e => {
    pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true;
    pointer.nx = (e.clientX / W - 0.5) * 2;
    pointer.ny = (e.clientY / H - 0.5) * 2;
  };
  const onLeave = () => { pointer.active = false; pointer.x = pointer.y = -9999; pointer.nx = pointer.ny = 0; };
  const onResize = () => resize();

  let shooterTimer = 0;
  function scheduleShooter(){
    shooterTimer = setTimeout(() => {
      if (!document.hidden) spawnShooter();
      scheduleShooter();
    }, rand(3200, 9000));
  }

  const onVisibility = () => {
    if (document.hidden) stop();
    else start();
  };

  function start(){
    if (running || REDUCED) return;
    running = true;
    lastNow = performance.now();
    raf = requestAnimationFrame(loop);
  }
  function stop(){
    running = false;
    cancelAnimationFrame(raf);
  }

  /* --- go --- */
  resize();
  draw(performance.now());              // first frame, synchronously
  window.addEventListener("resize", onResize, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerleave", onLeave, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  if (!REDUCED){ start(); scheduleShooter(); spawnShooter(); }

  return {
    destroy(){
      stop();
      clearTimeout(shooterTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    },
    burst(){ for (let i = 0; i < 3; i++) setTimeout(spawnShooter, i * 180); }
  };
}

/* ---------------------------------------------------------- */
/*  Warp field — used behind the LIVE takeover                 */
/* ---------------------------------------------------------- */
export function initWarp(canvas){
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0, dpr = 1, raf = 0, parts = [], running = false;

  function resize(){
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
  }

  function build(){
    const n = Math.round(Math.min(260, Math.max(70, (W * H) / 9000)));
    parts = Array.from({ length: n }, () => seed(true));
  }

  function seed(spread){
    const ang = Math.random() * Math.PI * 2;
    const r = spread ? Math.random() * Math.hypot(W, H) * 0.5 : rand(0, 36);
    return {
      ang, r,
      sp: rand(1.4, 5.4),
      w: rand(0.7, 2.1),
      hue: pick(PALETTE),
      a: rand(0.3, 1)
    };
  }

  function draw(){
    ctx.clearRect(0, 0, W, H);
    const cx = W / 2, cy = H / 2;
    const maxR = Math.hypot(W, H) * 0.56;

    for (const p of parts){
      p.r += p.sp * (0.5 + p.r / maxR * 1.8);
      if (p.r > maxR) Object.assign(p, seed(false));

      const x1 = cx + Math.cos(p.ang) * p.r;
      const y1 = cy + Math.sin(p.ang) * p.r;
      const tail = Math.min(70, 6 + p.r * 0.14);
      const x2 = cx + Math.cos(p.ang) * (p.r - tail);
      const y2 = cy + Math.sin(p.ang) * (p.r - tail);
      const [r, g, b] = p.hue;
      const fade = p.a * Math.min(1, p.r / (maxR * 0.35));

      const grd = ctx.createLinearGradient(x1, y1, x2, y2);
      grd.addColorStop(0, `rgba(${r},${g},${b},${fade})`);
      grd.addColorStop(1, `rgba(${r},${g},${b},0)`);
      ctx.strokeStyle = grd;
      ctx.lineWidth = p.w;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
  }

  function loop(){ draw(); raf = requestAnimationFrame(loop); }

  const onResize = () => resize();
  resize();
  draw();
  window.addEventListener("resize", onResize, { passive: true });

  return {
    start(){ if (running || REDUCED) return; running = true; raf = requestAnimationFrame(loop); },
    stop(){ running = false; cancelAnimationFrame(raf); },
    destroy(){ this.stop(); window.removeEventListener("resize", onResize); }
  };
}

export const prefersReducedMotion = REDUCED;
