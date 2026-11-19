// Fixed scenes for screenshots: ?shot=editor shows the page with sample photos
// loaded and panels assigned; ?shot=cover shows the cover alone at the size the
// screenshot wants. `photo`, `photo2`, `photo3` pick the samples (samples/<name>.jpg),
// `caption` the title, `sub` the subtitle, `badge` the ribbon, `stars` the heat,
// `layout` / `grade` the look, and `preview` the preview aspect. The app's own
// drawing is what the screenshot shows — nothing is composited afterwards.
// window.__shotReady is set once painted.
export async function runShot(shot, query, applyScene) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photos = [
    query.get('photo') ?? 'pier',
    query.get('photo2') ?? 'boulevard',
    query.get('photo3') ?? 'neon',
  ];
  // Panels take the photos in rotation so a multi-panel layout shows the
  // mix; a single-panel layout just takes the first.
  const assign = [0, 1, 2, 0, 1, 2, 0, 1];
  await applyScene({
    photos,
    assign,
    preview: query.get('preview') ?? 'square',
    state: {
      layout: query.get('layout') ?? 'hero3',
      grade: query.get('grade') ?? 'sunset',
      title: query.get('caption') ?? 'Vice Coast',
      subtitle: query.get('sub') ?? 'neon nights, high stakes',
      badge: query.get('badge') ?? 'Vice Coast',
      stars: Number(query.get('stars') ?? 4),
      titleSpot: query.get('spot') ?? 'bottom',
      subStyle: query.get('substyle') ?? 'script',
    },
  });
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
