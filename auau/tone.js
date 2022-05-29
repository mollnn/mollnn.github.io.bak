// taken from https://stackoverflow.com/questions/6343450/generating-sound-on-the-fly-with-javascript-html5

audioCtx = new(window.AudioContext || window.webkitAudioContext)();

show();

function show() {
  frequency = 10 ** document.getElementById("fIn").value;
  document.getElementById("fOut").innerHTML = frequency.toPrecision(5) + ' Hz';

  switch (document.getElementById("tIn").value * 1) {
    case 0: type = 'sine'; break;
    case 1: type = 'square'; break;
    case 2: type = 'sawtooth'; break;
    case 3: type = 'triangle'; break;
  }
  document.getElementById("tOut").innerHTML = type;

  volume = document.getElementById("vIn").value / 100;
  document.getElementById("vOut").innerHTML = volume;

  duration = document.getElementById("dIn").value;
  document.getElementById("dOut").innerHTML = duration + ' ms';
}

function beep() {
  var oscillator = audioCtx.createOscillator();
  var gainNode = audioCtx.createGain();
  var playButton = document.getElementById("play")

  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  gainNode.gain.value = volume;
  oscillator.frequency.value = frequency;
  oscillator.type = type;

  oscillator.start();
  playButton.style.background = "red";

  setTimeout(
    function() {
      oscillator.stop();
      playButton.style.background = "#0F0";
    },
    duration
  );
};
