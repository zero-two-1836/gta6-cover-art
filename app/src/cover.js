// Vice Coast Cover Lab — the cover engine.
// Draws GTA-6-style multi-panel poster art from photos + lettering, entirely on a
// 2D canvas. Every visual is drawn in code: sunset discs, palm silhouettes, neon
// panel edges, gradient-map grades, a two-tone display title with a hand-built
// outline and glow, and a script or spaced-caps subtitle. No Rockstar logo,
// artwork or font is used anywhere.
//
// A cover is a pure function of `state`:
//   state = {
//     layout: 'bleed' | 'hero3' | 'four' | 'nine' | 'tilted' | 'duo' | 'triptych' | 'magazine',
//     grade:  'sunset' | 'vice' | 'dusk' | 'golden' | 'noir' | 'hotpink',
//     gradeStrength: 0..100, title, subtitle, subStyle: 'script'|'caps'|'none',
//     titleSize: 60..140 (percent), titleSpot: 'bottom'|'top'|'hero',
//     outline: 0..14, badge, stars (0-5),
//     frame, grain, vignette, sun, neonEdge (booleans),
//     panels: [{ img, photoIndex, zoom, ox, oy, flip }]
//   }
// drawCover(ctx, state, W, H) renders it at any size; renderCover(state, w, h)
// returns a fresh canvas at that size.

export const LAYOUTS = {
  bleed: { name: 'Full Bleed', slots: 1 },
  hero3: { name: 'Hero + Three', slots: 4 },
  four: { name: 'Four Panel', slots: 4 },
  nine: { name: 'Nine Panel', slots: 8 },
  tilted: { name: 'Tilted Snaps', slots: 3 },
  duo: { name: 'Split Duo', slots: 2 },
  triptych: { name: 'Triptych', slots: 3 },
  magazine: { name: 'Magazine', slots: 3 },
};

export const GRADES = {
  sunset: {
    name: 'Sunset', top: '#ff9a3d', mid: '#ff5e7a', bottom: '#7b2fbe',
    wash: '#ff7a45', titleTop: '#fff6cf', titleBottom: '#ffb347', glow: '#ff5e7a', skyTop: '#ff8c42',
  },
  vice: {
    name: 'Vice Neon', top: '#ff2e88', mid: '#b537f2', bottom: '#00e5c7',
    wash: '#ff2e88', titleTop: '#eafffb', titleBottom: '#00e5c7', glow: '#ff2e88', skyTop: '#ff2e88',
  },
  dusk: {
    name: 'Dusk Purple', top: '#8e6cff', mid: '#5b2a86', bottom: '#1c0b2e',
    wash: '#8e6cff', titleTop: '#f3eaff', titleBottom: '#c9a7ff', glow: '#b537f2', skyTop: '#7c5cff',
  },
  golden: {
    name: 'Golden Hour', top: '#ffd76a', mid: '#ff9a3d', bottom: '#c1440e',
    wash: '#ffb347', titleTop: '#fffbe8', titleBottom: '#ffc53d', glow: '#ff9a3d', skyTop: '#ffc53d',
  },
  noir: {
    name: 'Teal Noir', top: '#2dd4bf', mid: '#0e7490', bottom: '#082f49',
    wash: '#2dd4bf', titleTop: '#f0fdfa', titleBottom: '#5eead4', glow: '#2dd4bf', skyTop: '#155e75',
  },
  hotpink: {
    name: 'Hot Pink', top: '#ff7ad9', mid: '#ff2e88', bottom: '#4c0519',
    wash: '#ff2e88', titleTop: '#fff1f2', titleBottom: '#ff7ad9', glow: '#ff2e88', skyTop: '#ec4899',
  },
};

export const DISPLAY_FONT = '"Arial Black", "Archivo Black", "Helvetica Neue", sans-serif';
export const SCRIPT_FONT = '"Segoe Script", "Bradley Hand", "Comic Sans MS", cursive';

// Panel rectangles in normalised (0..1) coordinates. `title: true` marks the
// medallion cell of the nine-panel grid (badge + stars, no photo).
export function layoutRects(layout) {
  const g = 0.014;
  switch (layout) {
    case 'bleed':
      return [{ x: 0, y: 0, w: 1, h: 1 }];
    case 'hero3': {
      const rw = 0.38 - g;
      return [
        { x: 0, y: 0, w: 0.62 - g, h: 1 },
        { x: 0.62, y: 0, w: rw, h: (1 - 2 * g) / 3 },
        { x: 0.62, y: (1 + g) / 3, w: rw, h: (1 - 2 * g) / 3 },
        { x: 0.62, y: 2 * (1 + g) / 3, w: rw, h: (1 - 2 * g) / 3 },
      ];
    }
    case 'four': {
      const c = (1 - g) / 2;
      return [
        { x: 0, y: 0, w: c, h: c },
        { x: c + g, y: 0, w: c, h: c },
        { x: 0, y: c + g, w: c, h: c },
        { x: c + g, y: c + g, w: c, h: c },
      ];
    }
    case 'nine': {
      const c = (1 - 2 * g) / 3;
      const cells = [];
      for (let r = 0; r < 3; r++) {
        for (let col = 0; col < 3; col++) {
          cells.push({ x: col * (c + g), y: r * (c + g), w: c, h: c, title: r === 1 && col === 1 });
        }
      }
      return cells;
    }
    case 'tilted':
      return [
        { x: 0.06, y: 0.10, w: 0.30, h: 0.52, rot: -7 },
        { x: 0.35, y: 0.06, w: 0.30, h: 0.52, rot: 0 },
        { x: 0.64, y: 0.10, w: 0.30, h: 0.52, rot: 7 },
      ];
    case 'duo': {
      const c = (1 - g) / 2;
      return [
        { x: 0, y: 0, w: c, h: 1 },
        { x: c + g, y: 0, w: c, h: 1 },
      ];
    }
    case 'triptych': {
      const c = (1 - 2 * g) / 3;
      return [
        { x: 0, y: 0, w: c, h: 1 },
        { x: c + g, y: 0, w: c, h: 1 },
        { x: 2 * (c + g), y: 0, w: c, h: 1 },
      ];
    }
    case 'magazine': {
      const half = (1 - g) / 2;
      // Big hero strip on top, two panels below; the title band sits over the
      // hero's foot, so the lower panels stay clean for the photos.
      return [
        { x: 0, y: 0, w: 1, h: 0.58 - g },
        { x: 0, y: 0.58, w: half, h: 0.42 },
        { x: half + g, y: 0.58, w: half, h: 0.42 },
      ];
    }
    default:
      return [{ x: 0, y: 0, w: 1, h: 1 }];
  }
}

export function panelCount(layout) {
  return layoutRects(layout).filter((r) => !r.title).length;
}

// --- grain ----------------------------------------------------------------

let noiseTile = null;
function grainTile() {
  if (noiseTile) return noiseTile;
  noiseTile = document.createElement('canvas');
  noiseTile.width = 140;
  noiseTile.height = 140;
  const nctx = noiseTile.getContext('2d');
  const img = nctx.createImageData(140, 140);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 110 + Math.floor(Math.random() * 90);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  return noiseTile;
}

// --- sky art: sun disc + palm silhouettes ---------------------------------

function drawSunAndPalms(ctx, grade, W, H) {
  const cx = W * 0.5;
  const cy = H * 0.30;
  const r = Math.min(W, H) * 0.20;
  const glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.4);
  glow.addColorStop(0, grade.top);
  glow.addColorStop(0.45, grade.mid);
  glow.addColorStop(1, 'rgba(18, 4, 31, 0)');
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;
  const disc = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  disc.addColorStop(0, '#fff7d6');
  disc.addColorStop(0.55, grade.titleBottom);
  disc.addColorStop(1, grade.mid);
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // Retro slats cut across the lower half of the disc.
  ctx.fillStyle = '#2b1040';
  for (let i = 0; i < 4; i++) {
    const yy = cy + r * (0.08 + i * 0.2);
    const hh = r * (0.03 + i * 0.025);
    ctx.fillRect(cx - r, yy, r * 2, hh);
  }
  ctx.restore();
  drawPalm(ctx, W * 0.10, H * 0.94, H * 0.30, -0.18);
  drawPalm(ctx, W * 0.92, H * 0.96, H * 0.26, 0.22);
}

function drawPalm(ctx, baseX, baseY, size, lean) {
  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(lean);
  ctx.strokeStyle = 'rgba(10, 3, 18, 0.95)';
  ctx.lineWidth = size * 0.045;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(size * 0.06, -size * 0.55, size * 0.02, -size);
  ctx.stroke();
  ctx.fillStyle = 'rgba(10, 3, 18, 0.95)';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * (0.08 + i * 0.13);
    const len = size * (0.42 - Math.abs(i - 3) * 0.05);
    ctx.save();
    ctx.translate(size * 0.02, -size);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(len / 2, 0, len / 2, size * 0.035, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

// --- photos -----------------------------------------------------------------

function drawPhotoInto(ctx, img, rect, zoom, ox, oy, flip) {
  const { x, y, w, h } = rect;
  const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (zoom || 1);
  const pw = img.naturalWidth * base;
  const ph = img.naturalHeight * base;
  const cx = x + w / 2 + (ox || 0) * w;
  const cy = y + h / 2 + (oy || 0) * h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  if (flip) {
    ctx.translate(cx * 2, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, cx - pw / 2, cy - ph / 2, pw, ph);
  ctx.restore();
}

function gradePanel(ctx, rect, grade, strength) {
  const { x, y, w, h } = rect;
  const k = Math.max(0, Math.min(100, strength ?? 80)) / 100;
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, grade.top);
  grad.addColorStop(0.55, grade.mid);
  grad.addColorStop(1, grade.bottom);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = 0.85 * k;
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.35 * k;
  ctx.fillStyle = grade.wash;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

function inkBand(ctx, rect, W, neon, glowColor) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.lineWidth = Math.max(2, W * 0.004);
  ctx.strokeStyle = 'rgba(16, 6, 26, 0.9)';
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.lineWidth = Math.max(1, W * 0.0015);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeRect(x + W * 0.006, y + W * 0.006, w - W * 0.012, h - W * 0.012);
  if (neon) {
    ctx.lineWidth = Math.max(2, W * 0.003);
    ctx.strokeStyle = glowColor;
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = W * 0.012;
    ctx.strokeRect(x + W * 0.012, y + W * 0.012, w - W * 0.024, h - W * 0.024);
  }
  ctx.restore();
}

// --- lettering --------------------------------------------------------------

function fitFont(ctx, text, family, weight, maxWidth, startSize, minSize) {
  let size = startSize;
  ctx.font = `${weight} ${size}px ${family}`;
  while (ctx.measureText(text).width > maxWidth && size > minSize) {
    size -= 2;
    ctx.font = `${weight} ${size}px ${family}`;
  }
  return size;
}

function drawStar(ctx, cx, cy, r, fill) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = cx + Math.cos(ang) * rad;
    const py = cy + Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();
}

// The title block: gradient display capitals with a dark outline, a soft glow,
// and a subtitle in neon script or spaced caps. `spot` moves it top / bottom /
// over the hero panel; `scalePct` is the user's title-size slider.
function drawTitleBlock(ctx, state, grade, W, H, heroRect) {
  const title = (state.title || '').trim().toUpperCase();
  const sub = (state.subtitle || '').trim();
  if (!title && !sub) return;
  const scale = (state.titleSize ?? 100) / 100;
  const bandH = H * 0.26;
  let bandY;
  if (state.titleSpot === 'top') bandY = 0;
  else if (state.titleSpot === 'hero' && heroRect) bandY = heroRect.y + heroRect.h - bandH;
  else bandY = H - bandH;

  const scrim = ctx.createLinearGradient(0, bandY - H * 0.05, 0, bandY + bandH);
  if (state.titleSpot === 'top') {
    scrim.addColorStop(0, 'rgba(12, 4, 22, 0.88)');
    scrim.addColorStop(0.55, 'rgba(12, 4, 22, 0.62)');
    scrim.addColorStop(1, 'rgba(12, 4, 22, 0)');
  } else {
    scrim.addColorStop(0, 'rgba(12, 4, 22, 0)');
    scrim.addColorStop(0.45, 'rgba(12, 4, 22, 0.62)');
    scrim.addColorStop(1, 'rgba(12, 4, 22, 0.88)');
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, Math.max(0, bandY - H * 0.05), W, bandH + H * 0.05);

  const cx = W / 2;
  if (title) {
    const maxSize = H * 0.115 * scale;
    const size = fitFont(ctx, title, DISPLAY_FONT, 900, W * 0.92, maxSize, 14);
    const grad = ctx.createLinearGradient(0, bandY + bandH * 0.15, 0, bandY + bandH * 0.75);
    grad.addColorStop(0, grade.titleTop);
    grad.addColorStop(1, grade.titleBottom);
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const outline = state.outline ?? 8;
    if (outline > 0) {
      ctx.lineWidth = size * (outline / 100);
      ctx.strokeStyle = 'rgba(16, 6, 26, 0.92)';
    }
    ctx.shadowColor = grade.glow;
    ctx.shadowBlur = size * 0.28;
    ctx.fillStyle = grad;
    const ty = bandY + bandH * (sub && state.subStyle !== 'none' ? 0.36 : 0.52);
    if (outline > 0) ctx.strokeText(title, cx, ty);
    ctx.fillText(title, cx, ty);
    ctx.restore();
  }
  if (sub && state.subStyle !== 'none') {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (state.subStyle === 'caps') {
      const spaced = sub.toUpperCase().split('').join(' ');
      const size = fitFont(ctx, spaced, DISPLAY_FONT, 700, W * 0.82, H * 0.038, 10);
      ctx.font = `700 ${size}px ${DISPLAY_FONT}`;
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = grade.glow;
      ctx.shadowBlur = size * 0.6;
      ctx.fillText(spaced, cx, bandY + bandH * 0.82);
    } else {
      const size = fitFont(ctx, sub, SCRIPT_FONT, 400, W * 0.8, H * 0.052, 12);
      ctx.font = `${size}px ${SCRIPT_FONT}`;
      ctx.shadowColor = grade.glow;
      ctx.shadowBlur = size * 0.55;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(sub, cx, bandY + bandH * 0.82);
    }
    ctx.restore();
  }
}

function drawMedallion(ctx, rect, state, grade, W) {
  const { x, y, w, h } = rect;
  ctx.save();
  ctx.fillStyle = '#14061e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = grade.glow;
  const step = Math.max(8, w * 0.09);
  for (let yy = y + step; yy < y + h - step * 0.5; yy += step) {
    for (let xx = x + step; xx < x + w - step * 0.5; xx += step) {
      ctx.globalAlpha = 0.22;
      ctx.beginPath();
      ctx.arc(xx, yy, Math.max(1, step * 0.12), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badge = (state.badge || 'EST. 2026').toUpperCase();
  const bSize = fitFont(ctx, badge, DISPLAY_FONT, 900, w * 0.86, h * 0.16, 10);
  ctx.font = `900 ${bSize}px ${DISPLAY_FONT}`;
  ctx.fillStyle = grade.titleBottom;
  ctx.fillText(badge, cx, cy - h * 0.16);
  const starR = Math.min(w, h) * 0.062;
  const gap = starR * 2.4;
  const x0 = cx - 2 * gap;
  for (let i = 0; i < 5; i++) {
    drawStar(ctx, x0 + i * gap, cy + h * 0.12, starR, i < state.stars ? grade.glow : 'rgba(255,255,255,0.25)');
  }
  ctx.restore();
}

function drawBadgeRibbon(ctx, state, grade, W, H) {
  const badge = (state.badge || '').trim().toUpperCase();
  if (!badge || state.layout === 'nine') return;
  const size = Math.max(13, H * 0.028);
  ctx.save();
  ctx.font = `900 ${size}px ${DISPLAY_FONT}`;
  const tw = ctx.measureText(badge).width;
  const pad = size * 0.9;
  const bw = tw + pad * 2;
  const bh = size * 1.9;
  ctx.translate(W * 0.045 + bw / 2, H * 0.045 + bh / 2);
  ctx.rotate(-0.06);
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = size * 0.7;
  ctx.fillStyle = grade.glow;
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#14061e';
  ctx.fillRect(-bw / 2, -bh / 2, bw, bh * 0.16);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, 0, size * 0.08);
  ctx.restore();
}

// --- main entry -------------------------------------------------------------

/** Draws the whole cover onto `ctx` (a 2D context of a W x H canvas). */
export function drawCover(ctx, state, W, H) {
  const grade = GRADES[state.grade] || GRADES.sunset;
  const rects = layoutRects(state.layout);

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, grade.skyTop);
  sky.addColorStop(0.55, '#4c1d95');
  sky.addColorStop(1, '#12041f');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  if (state.sun && (state.layout === 'tilted' || state.layout === 'bleed' || state.layout === 'magazine')) {
    drawSunAndPalms(ctx, grade, W, H);
  }

  const photoRects = rects.filter((r) => !r.title);
  photoRects.forEach((r, i) => {
    const panel = state.panels[i] || {};
    const px = r.x * W;
    const py = r.y * H;
    const pw = r.w * W;
    const ph = r.h * H;
    ctx.save();
    if (r.rot) {
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((r.rot * Math.PI) / 180);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
      ctx.fillStyle = '#fdfbf7';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
      ctx.shadowBlur = W * 0.02;
      ctx.shadowOffsetY = W * 0.008;
      const b = W * 0.012;
      ctx.fillRect(px - b, py - b, pw + b * 2, ph + b * 2 + H * 0.045);
      ctx.restore();
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.rotate((r.rot * Math.PI) / 180);
      ctx.translate(-(px + pw / 2), -(py + ph / 2));
    }
    if (panel.img) {
      drawPhotoInto(ctx, panel.img, { x: px, y: py, w: pw, h: ph }, panel.zoom, panel.ox, panel.oy, panel.flip);
      gradePanel(ctx, { x: px, y: py, w: pw, h: ph }, grade, state.gradeStrength);
    } else {
      const g2 = ctx.createLinearGradient(px, py, px + pw, py + ph);
      g2.addColorStop(0, grade.mid);
      g2.addColorStop(1, grade.bottom);
      ctx.fillStyle = g2;
      ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = `900 ${Math.max(12, pw * 0.07)}px ${DISPLAY_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ADD PHOTO', px + pw / 2, py + ph / 2);
    }
    if (!r.rot) inkBand(ctx, { x: px, y: py, w: pw, h: ph }, W, state.neonEdge, grade.glow);
    ctx.restore();
  });

  const medallion = rects.find((r) => r.title);
  if (medallion) {
    const mr = { x: medallion.x * W, y: medallion.y * H, w: medallion.w * W, h: medallion.h * H };
    drawMedallion(ctx, mr, state, grade, W);
    inkBand(ctx, mr, W, state.neonEdge, grade.glow);
  }

  const heroRect = photoRects[0]
    ? { x: photoRects[0].x * W, y: photoRects[0].y * H, w: photoRects[0].w * W, h: photoRects[0].h * H }
    : null;
  drawTitleBlock(ctx, state, grade, W, H, heroRect);
  drawBadgeRibbon(ctx, state, grade, W, H);

  if (state.frame) {
    ctx.save();
    ctx.lineWidth = Math.max(6, W * 0.012);
    ctx.strokeStyle = '#fdfbf7';
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, W - ctx.lineWidth, H - ctx.lineWidth);
    ctx.restore();
  }

  if (state.vignette) {
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.72);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(8,2,16,0.42)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, W, H);
  }

  if (state.grain) {
    ctx.save();
    ctx.globalAlpha = 0.07;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
}

/** Renders `state` to a fresh canvas at (w, h) and returns it. */
export function renderCover(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas.getContext('2d'), state, w, h);
  return canvas;
}
