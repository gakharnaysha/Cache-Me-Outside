
export enum GrowthStage {
  EMPTY = 'EMPTY',
  SEED = 'SEED',
  SPROUT = 'SPROUT',
  BUD = 'BUD',
  FLOWER = 'FLOWER',
  WITHERED = 'WITHERED'
}

export enum Weather {
  SUNNY = 'Sunny',
  RAINY = 'Rainy',
  STORM = 'Storm',
  HEATWAVE = 'Heatwave'
}

export enum MarketMood {
  HAPPY = 'Super Popular! 🌟',
  NORMAL = 'Just Right ⚖️',
  SLEEPY = 'Sleepy Market 😴'
}

export interface Plant {
  id: string;
  name: string;
  icon: string;
  baseSeedCost: number;
  baseSellPrice: number;
  growthTime: number; 
}

export interface CurrentPrice {
  seedCost: number;
  isPopular: boolean;
  isCheap: boolean;
}

export interface Plot {
  id: number;
  plantId: string | null;
  stage: GrowthStage;
  growthProgress: number; 
  isWatered: boolean;
  hasPests: boolean;
  isLocked: boolean;
  ripeTicks: number; // Tracks how long a flower has been unharvested
}

export interface LedgerEntry {
  day: number;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  amount: number;
}

export interface WeatherType {
  type: Weather;
  chance: number;
}

export interface GameEvent {
  id: string;
  name: string;
  chance: number;
  message: string;
}
