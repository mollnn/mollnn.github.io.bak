CanvasRenderingContext2D.prototype.clear = function() {
  this.fillStyle = "#fafafa";
  this.fillRect(0,0,this.canvas.width, this.canvas.height);
  this.strokeStyle = "#5a5a5a";
}
CanvasRenderingContext2D.prototype.labelText = function(text, x, y, c = "black") {
  this.font = "10px Arial";
  this.fillStyle = c;
  this.textAlign = "center";
  this.fillText(text, x, y);
}

var waveCtx = waveform.getContext("2d");
var zoomCtx = wavezoom.getContext("2d");
var fftCtx = wavefft.getContext("2d");
var AudioContext = window.AudioContext || window.webkitAudioContext;
var aCtx = new AudioContext();
var sampleRate = aCtx.sampleRate;
// the scriptnode never actually outputs anything, but the AudioNode graph needs to be connected
// or no processing happens
var scriptnode = aCtx.createScriptProcessor(512,1,1);
var gainnode = aCtx.createGain();
var recordingState = false;
var rawdata = new Float32Array(44100*30);
rawindex = 0;

document.addEventListener("DOMContentLoaded", 
  function() { initializePlayers(); }, false);

waveCtx.clear(); zoomCtx.clear(); fftCtx.clear();

navigator.mediaDevices.getUserMedia({ video: false, audio: true })
  .then(function(s) {
    playthru.srcObject = s;
    source = aCtx.createMediaStreamSource(s);
    source.connect(scriptnode);
    scriptnode.connect(gainnode);
    gainnode.gain.value = 0;
    gainnode.connect(aCtx.destination);
    mediaRecorder = new MediaRecorder(s);
    chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
  }
)
  .catch(e => log(e.name + ": "+ e.message));

var log = msg => logdiv.innerHTML += msg + "<br/>";

scriptnode.onaudioprocess = function(procEvent) {
  var inputBuf = procEvent.inputBuffer;
  var indata = inputBuf.getChannelData(0);
  if (recordingState) {
    for (var i=0; i<inputBuf.length; i++) {
      rawdata[rawindex+i] = indata[i];
    }
    rawindex += inputBuf.length;
  }
}

document.getElementById("record").onmousedown = function() {
  log("mousedown on record");
  aCtx.resume().then( () => { console.log('playback resumed');});
  rawdata.fill(0);
  rawindex = 0;
  mediaRecorder.start();
  recordingState = true;
};

document.getElementById("record").onmouseup = function() {
  setTimeout(stopRecording, 100);
}

function initializePlayers() {
  document.getElementById('sampled').controls = false;
  document.getElementById('snippet').controls = false;
}

function playSample() {
  document.getElementById('sampled').play();
}

function playSnippet() {
  var player = document.getElementById('snippet');
  var button = document.getElementById('playSnippet');
  if (player.paused || player.ended) {
    player.play();
  } else {
    player.pause();
  }
}

function stopRecording() {
  log("mouseup on record");
  mediaRecorder.stop();
  recordingState = false;
  // do stuff with rawdata
  //zoomUpdate();
  // do stuff with mediaRecorder chunks
  //blob = new Blob(chunks, {'type':'audio/mpeg'});
  chunks = []; // clear chunks for next recording
  //sampled.src = window.URL.createObjectURL(blob);
  //sampled.load();
  // make save available
  var dataview = encodeMonoWAV(rawdata.slice(0,rawindex), sampleRate);
  var audioBlob = new Blob([dataview], { type: "audio/wav" });
  var url = (window.URL || window.webkitURL).createObjectURL(audioBlob);
  sampled.src = url;
  sampled.load();
  var link = document.getElementById("save");
  link.style="visibility:visible";
  link.href = url;
  link.download = 'output.wav';
  zoomUpdate();
};

document.getElementById("zoomin").onclick = () => {fftexp.value -= 1; zoomUpdate()};
document.getElementById("zoomout").onclick = () => {fftexp.value -= -1; zoomUpdate()};
document.getElementById("sniploop").onclick = () => { snippet.loop = !snippet.loop }
document.getElementById("zoomstart").onchange = zoomUpdate;
document.getElementById("fftexp").onchange = zoomUpdate;
document.getElementById("freqmin").onchange = zoomUpdate;
document.getElementById("freqmax").onchange = zoomUpdate;
document.getElementById("logtoggle").onchange = zoomUpdate;
document.getElementById("guidetoggle").onchange = zoomUpdate;
document.getElementById("guidefreq").onchange = zoomUpdate;
document.getElementById("reverseplay").onchange = zoomUpdate;

waveform.addEventListener("mousedown", function(evt) {
  var mousePos = getMousePos(waveform, evt);
  zoomstart.value = Math.round(mousePos.x * rawindex);
  zoomUpdate();
}, false)

wavefft.addEventListener("mousedown", function(evt) {
  var mousePos = getMousePos(wavefft, evt);
  guidefreq.value = Math.round(mousePos.x * (freqmax.value - freqmin.value) + Number(freqmin.value));
  zoomUpdate();
})

function zoomUpdate() {
  var zoomend = Number(zoomstart.value) + 2**fftexp.value;
  drawWaveform(waveCtx, rawdata.slice(0,rawindex), 0, rawindex);
  drawZoombox(waveCtx, zoomstart.value/rawindex, zoomend/rawindex);
  drawWaveform(zoomCtx, rawdata.slice(zoomstart.value, zoomend), Number(zoomstart.value), zoomend);
  fftchunk = rawdata.slice(zoomstart.value, zoomend);
  doPowspec(fftchunk);
  drawWavespec(fftCtx, fftchunk);
  var slicedData = rawdata.slice(zoomstart.value, zoomend);
  if (reverseplay.checked) {
    slicedData.reverse();
  }
  var blob2 = new Blob([encodeMonoWAV(slicedData, sampleRate)], {type:"audio/wav"});
  snippet.src = (window.URL || window.webkitURL).createObjectURL(blob2);
  snippet.load();
}

function getMousePos(canvas, evt) {
  var rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left)/canvas.width,
    y: (evt.clientY - rect.top)/canvas.height
  };
}

function doPowspec(real) {
  var imag = real.slice(0);
  imag.fill(0);
  fft2(real,imag);
  for (var i=0; i<real.length; i++) {
    real[i] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
  }
}

function drawWavespec(cx, d) {
  var df = sampleRate / (2**fftexp.value);
  var fftmax = freqmax.value / df;
  var fftmin = freqmin.value / df;
  var plotted = d.slice(fftmin, fftmax);
  var h = cx.canvas.height;
  var w = cx.canvas.width;
  cx.clear();
  cx.beginPath();
  var scaley = h * 0.92 / Math.max(...plotted);
  var scalex = w / plotted.length;
  if (logtoggle.checked) {
    var logmax = Math.log10(Math.max(...plotted));
    var logmin = -1.5;
    for (var i=0; i<plotted.length; i++) {
      cx.lineTo(scalex*i, h*(0.92 - 0.92*(Math.log10(plotted[i]) - logmin)/(logmax-logmin)));
    }
  } else {
    for (var i=0; i<plotted.length; i++) {
      cx.lineTo(scalex*i, h*0.92 - scaley*plotted[i]);
    }
  }
  cx.stroke();
  cx.closePath();
  if (guidetoggle.checked) {
    var freq, x;
    cx.beginPath();
    for (var i=1; i<64; i++) {
      freq = i*guidefreq.value;
      x = (freq - freqmin.value) / (freqmax.value - freqmin.value);
      cx.moveTo(x*w, h/2 - h*0.03*(2 + 3*(i == 1) + (i%4 == 0)));
      cx.lineTo(x*w, h/2 + h*0.03*(2 + 3*(i == 1) + (i%4 == 0)));
      cx.labelText(i, x*w, 20, "red");
    }
    cx.strokeStyle = "#f00";
    cx.stroke();
    cx.closePath();
  }
  for (var i=0.05; i<1; i+=0.1) {
    var freq = Math.round((fftmin + i*(fftmax-fftmin))*df);
    cx.labelText(freq + " Hz", w * i, h);
  }
}

function drawZoombox(cx, a, b) {
  var h = cx.canvas.height;
  var w = cx.canvas.width;
  cx.beginPath();
  cx.strokeStyle = "#4285f4";
  cx.rect(a*w, 10, (b-a)*w, h-20)
  cx.rect(a*w-2, 10, (b-a)*w+2, h-20)
  cx.stroke();
}

function drawWaveform(cx, d, a, b) {
  var h = cx.canvas.height;
  var w = cx.canvas.width;
  cx.clear();
  cx.beginPath();
  cx.moveTo(0,h/2);
  var scaley = (h/2) / absmax(d);
  var scalex = w / d.length;
  for (var i=0; i<d.length; i++) {
    cx.lineTo(scalex*i, h/2-scaley*d[i]);
  }
  cx.stroke();
  cx.closePath();
  for (var i=0.05; i<1; i+=0.1) {
    var time = ((a + (b-a)*i) / sampleRate).toFixed(4);
    cx.labelText(time, w*i, h);
  }
}

// this is to get around "call stack size exceeded" errors from the simpler ... notation
function absmax(d) {
  var max = 0;
  for (var i=0; i<d.length; i++) {
    if (Math.abs(d[i]) > max) max = Math.abs(d[i]);
  }
  return max;
}

zoomUpdate();
