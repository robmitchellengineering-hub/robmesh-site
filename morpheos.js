'use strict';
// MorpheOS boot-screen demo card: lazy-load the iframe on first expand + a fullscreen button.
(function () {
  const card = document.getElementById('morpheos-card');
  const frame = document.getElementById('morpheos-frame');
  if (!card || !frame) return;

  let loaded = false;
  card.addEventListener('toggle', () => {
    if (card.open && !loaded) {
      loaded = true;
      frame.src = frame.getAttribute('data-src');
    }
  });

  const btn = document.querySelector('[data-fs-target="morpheos-frame"]');
  if (btn) {
    btn.addEventListener('click', () => {
      const el = document.fullscreenElement || document.webkitFullscreenElement;
      if (el) {
        if (document.exitFullscreen) document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (frame.requestFullscreen) {
        frame.requestFullscreen();
      } else if (frame.webkitRequestFullscreen) {
        frame.webkitRequestFullscreen();
      }
    });
  }
})();
