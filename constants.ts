
import { Plant, Weather, WeatherType, GameEvent } from './types';

export const MAX_GRID_SIZE = 15;
export const INITIAL_UNLOCKED = 5;
export const INITIAL_MONEY = 60;
export const TICK_SPEED = 2000; 

export const BASE_LAND_PRICE = 50;

export const BORROW_LIMIT = 200;
export const OVERDRAFT_FEE = 5; // Fee for having negative balance
export const BORROW_INTEREST_FEE = 2; // Flat fee for borrowed money

export const PLANTS: Plant[] = [
  { id: 'daisy', name: 'Happy Daisy', icon: '🌼', baseSeedCost: 5, baseSellPrice: 15, growthTime: 3 },
  { id: 'tulip', name: 'Pretty Tulip', icon: '🌷', baseSeedCost: 10, baseSellPrice: 25, growthTime: 5 },
  { id: 'rose', name: 'Red Rose', icon: '🌹', baseSeedCost: 20, baseSellPrice: 45, growthTime: 8 },
  { id: 'sunflower', name: 'Tall Sunnie', icon: '🌻', baseSeedCost: 15, baseSellPrice: 35, growthTime: 7 },
  { id: 'orchid', name: 'Magic Orchid', icon: '🌸', baseSeedCost: 40, baseSellPrice: 90, growthTime: 12 }
];

export const WEATHER_TYPES: WeatherType[] = [
  { type: Weather.SUNNY, chance: 0.6 },
  { type: Weather.RAINY, chance: 0.2 },
  { type: Weather.HEATWAVE, chance: 0.1 },
  { type: Weather.STORM, chance: 0.1 }
];

export const MAYOR_REASONS = [
  "Grass-walking tax",
  "No-hat fine",
  "Puppy treat fee",
  "Sunlight tax",
  "Giggle license"
];

export const EVENTS: GameEvent[] = [
  { id: 'party', name: 'The Mayor\'s Party', chance: 0.05, message: "The Mayor is happy today! He shared some coins for your garden! 🎈" },
  { id: 'pests', name: 'Silly Bugs', chance: 0.08, message: "Oh no! Some silly bugs are tickling your flowers. 🐛" },
  { id: 'fair', name: 'The Town Fair', chance: 0.05, message: "The Town Fair is here! Everyone wants beautiful flowers today! 🎀" },
  { id: 'icecream', name: 'Ice Cream Day', chance: 0.03, message: "Yum! You spent coins on a giant ice cream cone! 🍦" }
];
