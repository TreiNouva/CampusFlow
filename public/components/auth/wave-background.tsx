'use client';

import { useEffect, useRef } from 'react';

interface RibbonConfig {
  lineRatio: number; // proporsi jumlah garis terhadap lineCount
  sway: number; // simpangan vertikal (proporsi tinggi layar)
  swayFreq: number;
  swaySpeed: number;
  phase: number;
  minWidth: number; // lebar minimum pita (proporsi tinggi layar)
  maxWidth: number; // tambahan lebar maksimum
  widthFreq: number;
  widthSpeed: number;
  lineWidth: number;
  alpha: number;
}

/** Pita utama (besar & terang) + pita kedua (tipis & lebih transparan) agar selalu ada gerak di sekitar kartu. */
const RIBBONS: RibbonConfig[] = [
  { lineRatio: 1, sway: 0.26, swayFreq: 3.0, swaySpeed: 0.5, phase: 0, minWidth: 0.07, maxWidth: 0.42, widthFreq: 3.6, widthSpeed: 0.42, lineWidth: 0.9, alpha: 0.8 },
  { lineRatio: 0.55, sway: 0.34, swayFreq: 2.2, swaySpeed: 0.35, phase: 2.4, minWidth: 0.04, maxWidth: 0.17, widthFreq: 4.4, widthSpeed: -0.5, lineWidth: 0.8, alpha: 0.45 },
];

/**
 * Background halaman login/daftar:
 *  - Dasar biru gelap dengan "cahaya" biru muda yang bergerak pelan (gradasi dinamis).
 *  - Pita dari puluhan garis putih sejajar yang meliuk, menyempit, dan melebar
 *    (terinspirasi dari gambar referensi). Garis tidak pernah bersilangan.
 *  - Interaktif: garis melengkung menuju kursor dan "terseret" searah gerakan kursor,
 *    lalu kembali pelan-pelan saat kursor berhenti. Di HP bereaksi pada sentuhan/geser jari.
 *  - Ringan: jumlah garis menyesuaikan lebar layar, DPR dibatasi 2, animasi otomatis
 *    berhenti saat tab tidak aktif, dan hanya digambar statis jika "reduce motion" aktif.
 */
export function WaveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let lineCount = 56;
    let samples = 0;
    // Buffer dipakai ulang tiap frame (tanpa alokasi baru -> animasi mulus)
    let xs = new Float32Array(0);
    let center = new Float32Array(0);
    let width = new Float32Array(0);
    let bend = new Float32Array(0);

    const STEP = 8; // jarak horizontal antar titik sampel (px)
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, influence: 0, active: false };

    let raf = 0;
    let last = performance.now();
    let time = 3; // detik "animasi"

    function resize() {
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth;
      H = canvas.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      lineCount = W < 640 ? 36 : 56;
      samples = Math.ceil(W / STEP) + 3;
      xs = new Float32Array(samples);
      center = new Float32Array(samples);
      width = new Float32Array(samples);
      bend = new Float32Array(samples);
      if (reduceMotion) draw(time);
    }

    function draw(t: number) {
      if (!ctx) return;

      // ---------- Latar: biru gelap + cahaya biru muda yang bergerak ----------
      const base = ctx.createLinearGradient(0, 0, W, H);
      base.addColorStop(0, '#030c24');
      base.addColorStop(1, '#06193d');
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, W, H);

      const R = Math.max(W, H);
      const glows: [number, number, number, string, number][] = [
        [W * (0.18 + 0.12 * Math.sin(t * 0.23)), H * (0.22 + 0.18 * Math.cos(t * 0.19)), R * 0.62, '56,189,248', 0.38],
        [W * (0.82 + 0.1 * Math.cos(t * 0.17)), H * (0.78 + 0.14 * Math.sin(t * 0.27)), R * 0.66, '14,116,244', 0.5],
        [W * (0.55 + 0.22 * Math.sin(t * 0.13 + 1)), H * (0.4 + 0.2 * Math.cos(t * 0.21)), R * 0.5, '125,211,252', 0.22],
      ];
      for (const [gx, gy, gr, rgb, alpha] of glows) {
        const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
        g.addColorStop(0, `rgba(${rgb},${alpha})`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ---------- Interaksi kursor ----------
      const influence = mouse.influence;
      if (influence > 0.01) {
        const g = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R * 0.3);
        g.addColorStop(0, `rgba(125,211,252,${0.24 * influence})`);
        g.addColorStop(1, 'rgba(125,211,252,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ---------- Pita garis ----------
      const sigma = Math.max(140, Math.min(W, H) * 0.25);
      const inv = 1 / (2 * sigma * sigma);
      for (const ribbon of RIBBONS) drawRibbon(t, ribbon, inv);
    }

    /** Menggambar satu pita: bentuknya dihitung sekali per titik x, lalu dibagi ke N garis sejajar. */
    function drawRibbon(t: number, r: RibbonConfig, inv: number) {
      if (!ctx) return;
      const influence = mouse.influence;
      const lines = Math.round(lineCount * r.lineRatio);

      for (let k = 0; k < samples; k++) {
        const x = -STEP + k * STEP;
        const u = x / W;
        xs[k] = x;
        center[k] =
          H * 0.5 +
          H * r.sway * Math.sin(u * r.swayFreq + t * r.swaySpeed + r.phase) +
          H * 0.06 * Math.sin(u * 6.1 - t * 0.75 + 1.3 + r.phase);
        // Lebar pita: menyempit jadi lipatan padat lalu melebar lagi
        const wv = 0.5 + 0.5 * Math.sin(u * r.widthFreq - t * r.widthSpeed + 0.5 + r.phase) * Math.cos(u * 1.3 + t * 0.2);
        width[k] = H * (r.minWidth + r.maxWidth * Math.pow(Math.max(wv, 0), 1.15));
        // Lengkung asimetris (kesan 3D); selalu < lebar sehingga garis tidak bersilangan
        bend[k] = width[k] * 0.38 * Math.sin(u * 3.7 + t * 0.5 + 0.8 + r.phase);
      }

      ctx.lineWidth = r.lineWidth;
      ctx.lineJoin = 'round';
      for (let i = 0; i < lines; i++) {
        const s = i / (lines - 1) - 0.5; // -0.5 .. 0.5
        ctx.beginPath();
        for (let k = 0; k < samples; k++) {
          const x = xs[k];
          let y =
            center[k] +
            width[k] * s +
            bend[k] * (s * s - 0.25) +
            Math.sin((x / W) * 5 + t * 0.7 + s * 3) * width[k] * 0.03;

          if (influence > 0.01) {
            const dx = x - mouse.x;
            const dy = y - mouse.y;
            const f = Math.exp(-(dx * dx + dy * dy) * inv) * influence;
            // tertarik ke kursor + terseret searah gerak kursor
            y += (mouse.y - y) * f * 0.42 + mouse.vy * f * 9;
          }

          if (k === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = `rgba(255,255,255,${r.alpha - 0.22 * Math.abs(s) * 2})`;
        ctx.stroke();
      }
    }

    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 0.05); // batasi loncatan setelah tab kembali aktif
      last = now;
      time += dt;

      if (mouse.active) {
        const px = mouse.x;
        const py = mouse.y;
        mouse.x += (mouse.tx - mouse.x) * 0.12;
        mouse.y += (mouse.ty - mouse.y) * 0.12;
        // kecepatan dihaluskan -> efek "seret" memudar sendiri saat kursor berhenti
        mouse.vx = mouse.vx * 0.9 + (mouse.x - px) * 0.1;
        mouse.vy = mouse.vy * 0.9 + (mouse.y - py) * 0.1;
      } else {
        mouse.vx *= 0.9;
        mouse.vy *= 0.9;
      }
      mouse.influence += ((mouse.active ? 1 : 0) - mouse.influence) * 0.06;

      draw(time);
      raf = requestAnimationFrame(frame);
    }

    function onPointerMove(e: PointerEvent) {
      mouse.tx = e.clientX;
      mouse.ty = e.clientY;
      if (!mouse.active) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      }
      mouse.active = true;
    }
    function onPointerEnd(e: PointerEvent) {
      // Sentuhan selesai -> lepas pengaruh. (Mouse tetap aktif sampai keluar jendela.)
      if (e.pointerType !== 'mouse') mouse.active = false;
    }
    function onLeaveWindow(e: MouseEvent) {
      if (!e.relatedTarget) mouse.active = false;
    }

    resize();
    window.addEventListener('resize', resize);

    if (reduceMotion) {
      draw(time); // statis, tanpa animasi & tanpa interaksi
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true });
      window.addEventListener('pointerup', onPointerEnd, { passive: true });
      window.addEventListener('pointercancel', onPointerEnd, { passive: true });
      document.addEventListener('mouseout', onLeaveWindow);
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerEnd);
      window.removeEventListener('pointercancel', onPointerEnd);
      document.removeEventListener('mouseout', onLeaveWindow);
    };
  }, []);

  return <canvas ref={canvasRef} className="auth-canvas" aria-hidden="true" />;
}
