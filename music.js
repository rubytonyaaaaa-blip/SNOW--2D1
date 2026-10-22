// Three original local scores. User-controlled playback, equal-power scene crossfades.
const button = document.querySelector('#musicButton');
const volume = document.querySelector('#musicVolume');
const tracks = {
  bloom: document.querySelector('#ambientMusic'),
  snowfall: document.querySelector('#snowfallMusic'),
  sprawl: document.querySelector('#sprawlMusic')
};
const titles = { bloom: 'Bloom · piano and bells', snowfall: 'Snowfall · flowing winter', sprawl: 'Sprawl · crystal ambience' };
const keys = Object.keys(tracks);
const weights = { bloom: 0, snowfall: 0, sprawl: 0 };
let scene = 'bloom', requested = false, hiddenPause = false, operation = 0, animation = 0;
let masterVolume = Number(volume.value) / 100;
function update() {
  const playing = requested && keys.some(key => !tracks[key].paused);
  button.setAttribute('aria-pressed', String(playing));
  button.querySelector('span').textContent = playing ? 'Music on' : 'Music off';
  button.setAttribute('aria-label', playing ? 'Pause scene music' : 'Play scene music');
  button.title = (playing ? 'Pause: ' : 'Play: ') + titles[scene];
}
function paintVolumes() {
  keys.forEach(key => { tracks[key].volume = Math.min(1, masterVolume * Math.sqrt(Math.max(0, weights[key]))); });
}
function stopAll() {
  operation++;
  cancelAnimationFrame(animation);
  animation = 0;
  keys.forEach(key => { weights[key] = 0; tracks[key].volume = 0; tracks[key].pause(); });
  update();
}
async function transition(next) {
  const version = ++operation;
  const incoming = tracks[next];
  try { await incoming.play(); }
  catch {
    if (version === operation) { requested = false; stopAll(); button.title = 'Could not play music. Click to retry.'; }
    return;
  }
  if (version !== operation || !requested || document.hidden) {
    if (next !== scene || !requested || document.hidden) incoming.pause();
    return;
  }
  cancelAnimationFrame(animation);
  const from = { ...weights }, started = performance.now();
  function fade(now) {
    if (version !== operation || !requested || document.hidden) return;
    const progress = Math.max(0, Math.min(1, (now - started) / 1100));
    const eased = progress * progress * (3 - 2 * progress);
    keys.forEach(key => { weights[key] = from[key] + ((key === next ? 1 : 0) - from[key]) * eased; });
    paintVolumes();
    if (progress < 1) animation = requestAnimationFrame(fade);
    else { animation = 0; keys.forEach(key => { if (key !== next) tracks[key].pause(); }); update(); }
  }
  animation = requestAnimationFrame(fade);
  update();
}
keys.forEach(key => {
  tracks[key].volume = 0;
  tracks[key].addEventListener('play', update);
  tracks[key].addEventListener('pause', update);
  tracks[key].addEventListener('error', () => {
    if (requested && key === scene) { requested = false; stopAll(); button.title = 'Music unavailable. Reload and try again.'; }
  });
});
button.addEventListener('click', async () => {
  requested = !requested;
  hiddenPause = false;
  if (!requested) { stopAll(); return; }
  await transition(scene);
});
volume.addEventListener('input', () => { masterVolume = Number(volume.value) / 100; paintVolumes(); });
window.addEventListener('snowbloom:scene', async event => {
  const next = event.detail?.scene;
  if (!tracks[next] || next === scene) return;
  scene = next;
  if (requested && !document.hidden) await transition(scene);
  else update();
});
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { hiddenPause = requested; stopAll(); }
  else if (hiddenPause && requested) { hiddenPause = false; await transition(scene); }
});
window.addEventListener('pagehide', () => { requested = false; stopAll(); });
update();
