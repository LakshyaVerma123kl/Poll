// Web Audio API to generate synthetic premium UI sounds
// No external assets required!

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol, delay = 0) {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  
  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
  
  // Envelope
  gain.gain.setValueAtTime(0, audioCtx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + delay + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
  
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  osc.start(audioCtx.currentTime + delay);
  osc.stop(audioCtx.currentTime + delay + duration);
}

export const sounds = {
  success: () => {
    // Quick rising futuristic chime
    playTone(440, 'sine', 0.2, 0.1);
    playTone(554, 'sine', 0.2, 0.1, 0.05);
    playTone(659, 'sine', 0.4, 0.1, 0.1);
    playTone(880, 'sine', 0.6, 0.1, 0.15);
  },
  error: () => {
    // Low double buzz
    playTone(150, 'sawtooth', 0.15, 0.05);
    playTone(150, 'sawtooth', 0.2, 0.05, 0.2);
  },
  lock: () => {
    // Futuristic lock-in ka-chunk
    playTone(800, 'square', 0.1, 0.02);
    playTone(300, 'sine', 0.3, 0.1, 0.05);
  },
  hover: () => {
    // Very subtle high-frequency click
    playTone(1200, 'sine', 0.05, 0.005);
  }
};
