'use strict';
// MorpheOS boot-screen card: a fullscreen button for the embedded public page.
(function () {
  const frame = document.getElementById('morpheos-frame');
  if (!frame) return;
  const btn = document.querySelector('[data-fs-target="morpheos-frame"]');
  if (!btn) return;
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
})();
