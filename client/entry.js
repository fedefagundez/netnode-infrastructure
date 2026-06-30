import { App } from './App.js';

function initAudio() {
  if (typeof Sounds !== 'undefined') Sounds.init();
  document.removeEventListener('click', initAudio);
  document.removeEventListener('keydown', initAudio);
}
document.addEventListener('click', initAudio);
document.addEventListener('keydown', initAudio);

new App();
