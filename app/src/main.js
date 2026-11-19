// Vice Coast Cover Lab — wires the page.
// Photo tray + per-panel assignment, drag/wheel crop on the canvas, layout and
// grade pickers, one-tap looks, lettering controls, undo/redo history, and PNG
// export in 1080x1080, 1080x1350 and 1920x1080. A `?shot=` query sets up a
// fixed scene for a screenshot instead (./shots.js).
import { drawCover, renderCover, LAYOUTS, GRADES, panelCount } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const ctx = canvas.getContext('2d');
const $ = (id) => document.getElementById(id);

export const SIZES = {
  square: { name: 'Square 1080 × 1080', w: 1080, h: 1080 },
  portrait: { name: 'Portrait 1080 × 1350', w: 1080, h: 1350 },
  wide: { name: 'Wide 1920 × 1080', w: 1920, h: 1080 },
};

const DEFAULTS = {
  layout: 'hero3', grade: 'sunset', gradeStrength: 80,
  title: 'Vice Coast', subtitle: 'neon nights, high stakes', subStyle: 'script',
  titleSize: 100, titleSpot: 'bottom', outline: 8, badge: 'Vice Coast', stars: 4,
  frame: true, grain: true, vignette: true, sun: true, neonEdge: true,
};

let photos = []; // [{ img, name }]
let pickedPhoto = 0;
let selectedPanel = 0;
let sizeKey = 'square';
let state = freshState();
let history = [];
let future = [];

function freshState() {
  return { ...DEFAULTS, panels: Array.from({ length: 8 }, () => ({ img: null, photoIndex: -1, zoom: 1, ox: 0, oy: 0, flip: false })) };
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function snapshot() {
  return JSON.parse(JSON.stringify(state, (k, v) => (k === 'img' ? undefined : v)));
}
function pushHistory() {
  history.push(snapshot());
  if (history.length > 40) history.shift();
  future = [];
  syncUndoButtons();
}
function restore(snap) {
  // The snapshot keeps each panel's photoIndex; re-attach the live image
  // objects from the photo tray (snapshots never store the images themselves).
  state = { ...snap, panels: snap.panels.map((p) => ({ ...p, img: p.photoIndex >= 0 ? photos[p.photoIndex]?.img ?? null : null })) };
  syncControls();
  redraw();
}
function syncUndoButtons() {
  $('undo').disabled = history.length === 0;
  $('redo').disabled = future.length === 0;
}

function redraw() {
  drawCover(ctx, state, canvas.width, canvas.height);
  renderPanelStrip(panelCount(state.layout));
}

function renderPanelStrip(n) {
  const strip = $('panel-strip');
  strip.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (i === selectedPanel ? ' sel' : '');
    const p = state.panels[i];
    b.textContent = p.photoIndex >= 0 ? `Panel ${i + 1} · ${photos[p.photoIndex]?.name ?? 'photo'}` : `Panel ${i + 1} · empty`;
    b.addEventListener('click', () => {
      selectedPanel = i;
      if (photos[pickedPhoto]) assignPhoto(i, pickedPhoto);
      redraw();
    });
    strip.appendChild(b);
  }
  const p = state.panels[selectedPanel];
  if (p) {
    $('zoom').value = p.zoom;
    $('zoom-val').textContent = `${Math.round(p.zoom * 100)}%`;
  }
}

function renderTray() {
  const tray = $('photo-tray');
  tray.innerHTML = '';
  photos.forEach((ph, i) => {
    const img = document.createElement('img');
    img.className = 'thumb' + (i === pickedPhoto ? ' picked' : '');
    img.src = ph.img.src;
    img.alt = ph.name;
    img.title = ph.name + ' — click, then click a panel to place it';
    img.addEventListener('click', () => { pickedPhoto = i; renderTray(); });
    tray.appendChild(img);
  });
}

function assignPhoto(panelIndex, photoIndex) {
  const p = state.panels[panelIndex];
  if (!p || !photos[photoIndex]) return;
  p.img = photos[photoIndex].img;
  p.photoIndex = photoIndex;
  p.zoom = 1; p.ox = 0; p.oy = 0;
}

async function addPhotoFiles(files) {
  for (const file of files) {
    try {
      const img = await loadImage(URL.createObjectURL(file));
      photos.push({ img, name: file.name.replace(/\.[^.]+$/, '').slice(0, 18) || 'photo' });
    } catch { /* skip unreadable files */ }
  }
  if (photos.length === 0) return;
  pickedPhoto = photos.length - 1;
  // Fill empty panels with the new photo(s), left to right.
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    if (!state.panels[i].img) assignPhoto(i, pickedPhoto);
  }
  renderTray();
  redraw();
}

async function loadSample(name, label) {
  const img = await loadImage(`samples/${name}.jpg`);
  photos.push({ img, name: label });
  pickedPhoto = photos.length - 1;
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    if (!state.panels[i].img) assignPhoto(i, pickedPhoto);
  }
  renderTray();
  redraw();
}

// --- pickers ---------------------------------------------------------------

function buildPickers() {
  const layouts = $('layouts');
  Object.entries(LAYOUTS).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (key === state.layout ? ' active' : '');
    b.textContent = def.name;
    b.addEventListener('click', () => {
      pushHistory();
      state.layout = key;
      selectedPanel = 0;
      document.querySelectorAll('#layouts .btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      redraw();
    });
    layouts.appendChild(b);
  });
  const grades = $('grades');
  Object.entries(GRADES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch' + (key === state.grade ? ' active' : '');
    b.title = def.name;
    b.setAttribute('aria-label', def.name);
    b.style.background = `linear-gradient(135deg, ${def.top} 0%, ${def.mid} 55%, ${def.bottom} 100%)`;
    b.addEventListener('click', () => {
      pushHistory();
      state.grade = key;
      document.querySelectorAll('#grades .swatch').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      redraw();
    });
    grades.appendChild(b);
  });
  const sizes = $('sizes');
  Object.entries(SIZES).forEach(([key, def]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (key === sizeKey ? ' active' : '');
    b.textContent = def.name;
    b.addEventListener('click', () => {
      sizeKey = key;
      document.querySelectorAll('#sizes .btn').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    sizes.appendChild(b);
  });
}

function syncControls() {
  $('title').value = state.title;
  $('subtitle').value = state.subtitle;
  $('badge').value = state.badge;
  $('stars').value = String(state.stars);
  $('title-size').value = state.titleSize;
  $('title-spot').value = state.titleSpot;
  $('sub-style').value = state.subStyle;
  $('outline').value = state.outline;
  $('grade-strength').value = state.gradeStrength;
  $('frame').checked = state.frame;
  $('grain').checked = state.grain;
  $('vignette').checked = state.vignette;
  $('sun').checked = state.sun;
  $('neon-edge').checked = state.neonEdge;
  document.querySelectorAll('#layouts .btn').forEach((b, i) => b.classList.toggle('active', Object.keys(LAYOUTS)[i] === state.layout));
  document.querySelectorAll('#grades .swatch').forEach((b, i) => b.classList.toggle('active', Object.keys(GRADES)[i] === state.grade));
}

// --- events -----------------------------------------------------------------

function bindControls() {
  $('add-photos').addEventListener('click', () => $('photo').click());
  $('photo').addEventListener('change', (e) => addPhotoFiles([...e.target.files]));
  $('sample-boulevard').addEventListener('click', () => loadSample('boulevard', 'Boulevard'));
  $('sample-neon').addEventListener('click', () => loadSample('neon', 'Neon street'));
  $('sample-pier').addEventListener('click', () => loadSample('pier', 'Pier'));
  $('zoom').addEventListener('input', () => {
    const p = state.panels[selectedPanel];
    if (!p) return;
    p.zoom = Number($('zoom').value);
    $('zoom-val').textContent = `${Math.round(p.zoom * 100)}%`;
    redraw();
  });
  $('flip').addEventListener('click', () => {
    const p = state.panels[selectedPanel];
    if (!p) return;
    pushHistory();
    p.flip = !p.flip;
    redraw();
  });
  $('reset-crop').addEventListener('click', () => {
    const p = state.panels[selectedPanel];
    if (!p) return;
    pushHistory();
    p.zoom = 1; p.ox = 0; p.oy = 0; p.flip = false;
    redraw();
  });
  $('grade-strength').addEventListener('input', () => {
    state.gradeStrength = Number($('grade-strength').value);
    redraw();
  });
  $('title').addEventListener('input', () => { state.title = $('title').value; redraw(); });
  $('subtitle').addEventListener('input', () => { state.subtitle = $('subtitle').value; redraw(); });
  $('badge').addEventListener('input', () => { state.badge = $('badge').value; redraw(); });
  $('stars').addEventListener('change', () => { pushHistory(); state.stars = Number($('stars').value); redraw(); });
  $('title-size').addEventListener('input', () => { state.titleSize = Number($('title-size').value); redraw(); });
  $('title-spot').addEventListener('change', () => { pushHistory(); state.titleSpot = $('title-spot').value; redraw(); });
  $('sub-style').addEventListener('change', () => { pushHistory(); state.subStyle = $('sub-style').value; redraw(); });
  $('outline').addEventListener('input', () => { state.outline = Number($('outline').value); redraw(); });
  for (const id of ['frame', 'grain', 'vignette', 'sun', 'neon-edge']) {
    $(id).addEventListener('change', () => { state[{ frame: 'frame', grain: 'grain', vignette: 'vignette', sun: 'sun', 'neon-edge': 'neonEdge' }[id]] = $(id).checked; redraw(); });
  }
  $('preview-size').addEventListener('change', () => {
    const v = $('preview-size').value;
    if (v === 'portrait') { canvas.width = 608; canvas.height = 760; }
    else if (v === 'wide') { canvas.width = 760; canvas.height = 428; }
    else { canvas.width = 760; canvas.height = 760; }
    redraw();
  });
  $('look-sunset').addEventListener('click', () => applyLook('sunset', 85, 'bottom'));
  $('look-vice').addEventListener('click', () => applyLook('vice', 95, 'bottom'));
  $('look-noir').addEventListener('click', () => applyLook('noir', 70, 'top'));
  $('surprise').addEventListener('click', () => {
    pushHistory();
    const layoutKeys = Object.keys(LAYOUTS);
    const gradeKeys = Object.keys(GRADES);
    state.layout = layoutKeys[Math.floor(Math.random() * layoutKeys.length)];
    state.grade = gradeKeys[Math.floor(Math.random() * gradeKeys.length)];
    state.titleSpot = Math.random() > 0.5 ? 'bottom' : 'top';
    syncControls();
    redraw();
  });
  $('undo').addEventListener('click', () => {
    if (!history.length) return;
    future.push(snapshot());
    restore(history.pop());
    syncUndoButtons();
  });
  $('redo').addEventListener('click', () => {
    if (!future.length) return;
    history.push(snapshot());
    restore(future.pop());
    syncUndoButtons();
  });
  $('reset').addEventListener('click', () => {
    pushHistory();
    const imgs = state.panels.map((p) => p.img);
    state = freshState();
    state.panels.forEach((p, i) => { p.img = imgs[i] ?? null; p.photoIndex = imgs[i] ? photos.findIndex((ph) => ph.img === imgs[i]) : -1; });
    syncControls();
    redraw();
  });
  $('export-one').addEventListener('click', () => exportSize(sizeKey));
  $('export-all').addEventListener('click', async () => {
    for (const key of Object.keys(SIZES)) {
      await exportSize(key);
      $('status').textContent = `Exported ${SIZES[key].name} — ${Object.keys(SIZES).indexOf(key) + 1} of 3`;
    }
  });
}

function applyLook(grade, strength, spot) {
  pushHistory();
  state.grade = grade;
  state.gradeStrength = strength;
  state.titleSpot = spot;
  syncControls();
  redraw();
}

function exportSize(key) {
  return new Promise((resolve) => {
    const def = SIZES[key];
    const out = renderCover(state, def.w, def.h);
    out.toBlob((blob) => {
      if (!blob) { $('status').textContent = 'Export failed — try again.'; resolve(); return; }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `vice-coast-${def.w}x${def.h}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      $('status').textContent = `Saved vice-coast-${def.w}x${def.h}.png`;
      resolve();
    }, 'image/png');
  });
}

// Drag to pan the selected panel's photo, wheel to zoom it.
function bindCanvas() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const p = state.panels[selectedPanel];
    if (!p || !p.img) return;
    const rect = canvas.getBoundingClientRect();
    p.ox += (e.clientX - lastX) / rect.width;
    p.oy += (e.clientY - lastY) / rect.height;
    lastX = e.clientX;
    lastY = e.clientY;
    redraw();
  });
  canvas.addEventListener('pointerup', () => { dragging = false; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const p = state.panels[selectedPanel];
    if (!p || !p.img) return;
    p.zoom = Math.max(1, Math.min(4, p.zoom * (e.deltaY < 0 ? 1.08 : 0.92)));
    $('zoom').value = p.zoom;
    $('zoom-val').textContent = `${Math.round(p.zoom * 100)}%`;
    redraw();
  }, { passive: false });
}

// --- shot scenes ------------------------------------------------------------
// Exposed for shots.js: load sample photos by name, then apply a scene.
export async function applyShotScene(scene) {
  photos = [];
  for (const name of scene.photos) {
    const img = await loadImage(`samples/${name}.jpg`);
    photos.push({ img, name });
  }
  pickedPhoto = 0;
  state = { ...DEFAULTS, ...scene.state, panels: freshState().panels };
  const n = panelCount(state.layout);
  for (let i = 0; i < n; i++) {
    const pi = scene.assign[i] ?? (i % photos.length);
    assignPhoto(i, pi);
  }
  if (scene.preview) {
    if (scene.preview === 'portrait') { canvas.width = 608; canvas.height = 760; }
    else if (scene.preview === 'wide') { canvas.width = 760; canvas.height = 428; }
    else { canvas.width = 760; canvas.height = 760; }
  }
  renderTray();
  syncControls();
  redraw();
}

buildPickers();
bindControls();
bindCanvas();
syncUndoButtons();

const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  runShot(shot, params, applyShotScene);
} else {
  redraw();
}
