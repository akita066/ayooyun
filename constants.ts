import { PowerupType } from './types';

export const CANVAS_WIDTH = 2000;
export const CANVAS_HEIGHT = 2000;

// Fairness: Everyone sees exactly this much width in game units, regardless of monitor size
export const VIEWPORT_WIDTH = 1800; 

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

export const RADIO_STATIONS = [
  { name: 'Lo-Fi Beats', url: 'https://streams.ilovemusic.de/iloveradio17.mp3' },
  { name: 'Dance FM', url: 'https://streams.ilovemusic.de/iloveradio2.mp3' },
  { name: 'Rock Antenne', url: 'https://s2-webradio.antenne.de/rock-antenne' },
  { name: 'Swiss Classic', url: 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128' },
  { name: 'Power FM (TR)', url: 'https://powerfm.listen.powerapp.com.tr/powerfm/mpeg/icecast.audio' } 
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
