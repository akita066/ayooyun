import { PowerupType } from './types';

export const CANVAS_WIDTH = 2000;
export const CANVAS_HEIGHT = 2000;

// Fairness: Everyone sees exactly this much width in game units, regardless of monitor size
// Increased from 1800 to 2000 to zoom out the camera by ~10%
export const VIEWPORT_WIDTH = 2000; 

export const PLAYER_RADIUS = 25;
export const POTATO_RADIUS = 20;
export const POWERUP_RADIUS = 20;
export const SLIME_RADIUS = 80; // Size of the puddle

export const BASE_SPEED = 250; // pixels per second
export const POTATO_SPEED = 230; // Slightly slower than player
export const DASH_SPEED_MULTIPLIER = 2.5;

export const ABILITY_COOLDOWNS = {
  DASH: 8000,
  SHIELD: 20000, 
  SMOKE: 12000,
  SLIME: 15000, // Cooldown for R
};

export const ABILITY_DURATIONS = {
  DASH: 300,
  SHIELD: 3000,
  SMOKE: 5000,
  SLIME: 3000, // Puddle lasts 3 seconds
};

// Updated with verified HTTPS streams that support browser playback
export const RADIO_STATIONS = [
  { name: 'Power FM', url: 'https://powerfm.listen.powerapp.com.tr/powerfm/mpeg/icecast.audio' },
  { name: 'Kral Pop', url: 'https://yayin.kralpop.com.tr/kralpop/mpeg/icecast.audio' },
  { name: 'Power Türk', url: 'https://powerturk.listen.powerapp.com.tr/powerturk/mpeg/icecast.audio' },
  { name: 'Number One', url: 'https://n10101m.mediatriple.net/numberone' },
  { name: 'Number One Türk', url: 'https://n10101m.mediatriple.net/numberoneturk' },
  { name: 'Joy Türk', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/JOY_TURK_SC' },
  { name: 'Metro FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/METRO_FM_SC' },
  { name: 'Süper FM', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/SUPER_FM_SC' },
  { name: 'Virgin Radio', url: 'https://playerservices.streamtheworld.com/api/livestream-redirect/VIRGIN_RADIO_TR_SC' }
];

export const POWERUP_COLORS: Record<PowerupType, string> = {
  [PowerupType.SPEED]: '#FCD34D', // Yellow
  [PowerupType.COOLDOWN_RESET]: '#60A5FA', // Blue
  [PowerupType.GHOST]: '#A78BFA', // Purple
  [PowerupType.MAGNET]: '#F472B6', // Pink
  [PowerupType.FREEZE]: '#22D3EE', // Cyan
  [PowerupType.DOUBLE_POINTS]: '#4ADE80', // Green
};

export const POWERUP_EMOJIS: Record<PowerupType, string> = {
  [PowerupType.SPEED]: '⚡',
  [PowerupType.COOLDOWN_RESET]: '⏳',
  [PowerupType.GHOST]: '👻',
  [PowerupType.MAGNET]: '🧲',
  [PowerupType.FREEZE]: '❄️',
  [PowerupType.DOUBLE_POINTS]: '💎',
};

export const BUFF_EMOJIS = {
  SHIELD: '🛡️',
  SPEED: '💨',
  GHOST: '👻',
  SMOKE: '🌫️',
  FROZEN: '🧊',
  SILENCED: '😶',
  SLOWED: '🐌'
};

export const BOT_NAMES = [
  'Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Can', 'Cem', 'Deniz', 'Efe', 'Zeynep', 'Burak', 'Selin'
];

export const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e'
];

// Simple UI Click Sound (Short Pop) - Base64 to avoid external dependency issues
const CLICK_SOUND_B64 = "data:audio/wav;base64,UklGRi4AAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAAAAAAAgACAAIAAAACAAIAAAAA="; // Placeholder silence if needed, but using a real one below via AudioContext usually better, but let's use a very short real b64 for a "tick"
// A real short 'tick' sound
const UI_CLICK_SRC = "data:audio/wav;base64,UklGRl9vT1BXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; // Truncated for brevity, let's use a generated beep in function if needed, or a valid short b64.

// Generating a short beep using AudioContext is cleaner than a massive B64 string
export const playUiClick = () => {
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContext) return;
        
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(300, ctx.currentTime + 0.05);

        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    } catch (e) {
        console.error("Audio error", e);
    }
};