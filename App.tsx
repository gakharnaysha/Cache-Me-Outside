
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plot, GrowthStage, Weather, LedgerEntry, MarketMood, CurrentPrice, Plant } from './types';
import { MAX_GRID_SIZE, INITIAL_UNLOCKED, INITIAL_MONEY, PLANTS, WEATHER_TYPES, EVENTS, TICK_SPEED, BASE_LAND_PRICE, MAYOR_REASONS, BORROW_LIMIT, OVERDRAFT_FEE, BORROW_INTEREST_FEE } from './constants';
import PixelIcon from './components/PixelIcon';
import { getFinancialAdvice, chatWithGemini } from './services/geminiService';

// --- Definitions Library ---
const DEFINITIONS: Record<string, { title: string; text: string; icon: string }> = {
  WELCOME: {
    title: "GARDEN GUIDE",
    text: "Grow flowers and trade land to build your wealth! Watch out for Mayor Grumpy!",
    icon: "📖"
  },
  OVERDRAFT: {
    title: "OVERDRAFT",
    text: "This happens when you have less than 0 coins. The town charges you extra for being in the 'red'!",
    icon: "🚨"
  },
  INTEREST: {
    title: "INTEREST",
    text: "The 'rent' you pay to use the bank's money. It's a small fee that adds up over time!",
    icon: "📉"
  },
  RISK: {
    title: "FINANCIAL RISK",
    text: "Unexpected things (like Mayor Grumpy's taxes) that can take your coins away. Always keep a buffer!",
    icon: "🎲"
  },
  MARKET_VALUE: {
    title: "MARKET VALUE",
    text: "How much coins people are willing to pay for land today. It changes with the town's mood!",
    icon: "⚖️"
  },
  PROFIT: {
    title: "PROFIT",
    text: "The coins you keep after selling a flower for more than the seed cost. That's winning!",
    icon: "✨"
  },
  INVESTMENT: {
    title: "INVESTMENT",
    text: "Spending coins now (on land or seeds) because you expect to make more coins later!",
    icon: "🌳"
  },
  DEBT: {
    title: "BORROWING",
    text: "Using the bank's coins. You have to pay them back, but it's safer than an overdraft!",
    icon: "💳"
  },
  STOCKS: {
    title: "STOCKS",
    text: "Land is like a 'stock'. Buy it when the price is low (Sleepy Market) and sell when it's high (Happy Market)!",
    icon: "📈"
  }
};

// --- Sound Synthesis Utility ---
const playSound = (type: 'click' | 'money' | 'spend' | 'pop' | 'alert' | 'grumble' | 'decay' | 'loan') => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);

  const now = ctx.currentTime;

  switch (type) {
    case 'click':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'money':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'spend':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(100, now + 0.2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc.start(now);
      osc.stop(now + 0.2);
      break;
    case 'pop':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.1);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
      osc.start(now);
      osc.stop(now + 0.1);
      break;
    case 'alert':
      osc.type = 'square';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(330, now + 0.1);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
      break;
    case 'grumble':
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(40, now + 0.5);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'decay':
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.5);
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
      break;
    case 'loan':
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(1000, now + 0.4);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
      break;
  }
};

interface Notification {
  id: number;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
}

const App: React.FC = () => {
  const [gameStarted, setGameStarted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [money, setMoney] = useState(INITIAL_MONEY);
  const [day, setDay] = useState(1);
  const [weather, setWeather] = useState<Weather>(Weather.SUNNY);
  const [marketMood, setMarketMood] = useState<MarketMood>(MarketMood.NORMAL);
  const [currentPrices, setCurrentPrices] = useState<Record<string, CurrentPrice>>(
    Object.fromEntries(PLANTS.map(p => [p.id, { seedCost: p.baseSeedCost, isPopular: false, isCheap: false }]))
  );
  const [landPrice, setLandPrice] = useState(BASE_LAND_PRICE);
  const [priceHistory, setPriceHistory] = useState<number[]>([]);
  const [activeDefKey, setActiveDefKey] = useState<string>("WELCOME");
  
  // Borrowing State
  const [borrowedAmount, setBorrowedAmount] = useState(0);
  const [showDebtWarning, setShowDebtWarning] = useState(false);
  const [hasSeenDebtWarning, setHasSeenDebtWarning] = useState(false);

  const [plots, setPlots] = useState<Plot[]>(
    Array.from({ length: MAX_GRID_SIZE }, (_, i) => ({
      id: i,
      plantId: null,
      stage: GrowthStage.EMPTY,
      growthProgress: 0,
      isWatered: false,
      hasPests: false,
      isLocked: i >= INITIAL_UNLOCKED,
      ripeTicks: 0
    }))
  );
  
  const [inventory, setInventory] = useState<Record<string, number>>({});
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [activeEvent, setActiveEvent] = useState<string | null>(null);
  const [advice, setAdvice] = useState<string>("Welcome to your garden! Trade land to get coins! 🌸");
  const [showAdvice, setShowAdvice] = useState<boolean>(true);
  const [selectedSeed, setSelectedSeed] = useState<string | null>(PLANTS[0].id);
  const [view, setView] = useState<'garden' | 'shop' | 'bank'>('garden');
  const [focusedPlotId, setFocusedPlotId] = useState<number | null>(null);
  
  const [mayorPos, setMayorPos] = useState(-200);
  const [isMayorWalking, setIsMayorWalking] = useState(false);
  const [mayorMessage, setMayorMessage] = useState("");

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'bot'; text: string }[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hourRef = useRef(0);

  const isDebt = money < 0;

  useEffect(() => {
    if (isDebt) {
      document.body.classList.add('debt-mode');
      if (!hasSeenDebtWarning) {
        setShowDebtWarning(true);
        setHasSeenDebtWarning(true);
      }
    } else {
      document.body.classList.remove('debt-mode');
    }
  }, [isDebt, hasSeenDebtWarning]);

  const addLedgerEntry = (type: 'INCOME' | 'EXPENSE', description: string, amount: number) => {
    setLedger(prev => [{ day, type, description, amount }, ...prev].slice(0, 10));
    const id = Date.now();
    setNotifications(prev => [...prev, { id, amount, type }]);
    
    if (type === 'INCOME') playSound('money');
    else playSound('spend');

    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 2000);
  };

  const updateMoney = (amount: number, description: string) => {
    setMoney(prev => prev + amount);
    addLedgerEntry(amount >= 0 ? 'INCOME' : 'EXPENSE', description, Math.abs(amount));
    
    // Auto-update definitions based on description
    if (description.includes("Overdraft")) setActiveDefKey("OVERDRAFT");
    if (description.includes("Interest")) setActiveDefKey("INTEREST");
    if (description.includes("Mayor")) setActiveDefKey("RISK");
    if (description.includes("Harvested")) setActiveDefKey("PROFIT");
    if (description.includes("Bought Seed")) setActiveDefKey("INVESTMENT");
    if (description.includes("Bought Land")) setActiveDefKey("STOCKS");
  };

  const handleBorrow = () => {
    if (borrowedAmount + 50 > BORROW_LIMIT) {
      setAdvice("Woof! That's too much borrowing. My paws can't carry more coins! 🐕");
      playSound('alert');
      return;
    }
    setBorrowedAmount(prev => prev + 50);
    updateMoney(50, "Borrowed Coins");
    setActiveDefKey("DEBT");
    playSound('loan');
  };

  const handleRepay = () => {
    if (money < 50) {
      setAdvice("You need at least 50 coins to repay! 🦴");
      playSound('alert');
      return;
    }
    if (borrowedAmount <= 0) return;
    setBorrowedAmount(prev => prev - 50);
    updateMoney(-50, "Repaid Coins");
    playSound('money');
  };

  const spawnMayor = useCallback(() => {
    if (isMayorWalking) return;
    setIsMayorWalking(true);
    setMayorPos(-150);
    const reason = MAYOR_REASONS[Math.floor(Math.random() * MAYOR_REASONS.length)];
    const theft = 5 + Math.floor(Math.random() * 15);
    setMayorMessage(`${reason} - ${theft} 💰`);
    setAdvice(`Oh no! Mayor Grumpy is walking in for the ${reason}! 🐕`);
    setShowAdvice(true);
    setActiveDefKey("RISK");
    
    playSound('grumble');

    setTimeout(() => {
        updateMoney(-theft, `Mayor's ${reason}`);
    }, 4000);

    let currentPos = -150;
    const walkInterval = setInterval(() => {
        currentPos += 12;
        setMayorPos(currentPos);
        if (currentPos > window.innerWidth + 200) {
            clearInterval(walkInterval);
            setIsMayorWalking(false);
        }
    }, 100);
  }, [isMayorWalking]);

  const buyLand = () => {
    const nextLocked = plots.findIndex(p => p.isLocked);
    if (nextLocked === -1) return;
    updateMoney(-landPrice, "Bought Land Patch");
    setPlots(prev => prev.map((p, idx) => idx === nextLocked ? { ...p, isLocked: false } : p));
    setFocusedPlotId(null);
    setActiveDefKey("STOCKS");
    playSound('pop');
  };

  const sellLand = (id: number) => {
    const plot = plots.find(p => p.id === id);
    if (!plot || plot.isLocked) return;
    if (plots.filter(p => !p.isLocked).length <= 1) {
        setAdvice("Keep at least one patch for your dog to play on! 🐕");
        playSound('alert');
        return;
    }

    const resaleValue = Math.floor(landPrice * 0.95);
    updateMoney(resaleValue, "Sold Land Patch");
    setPlots(prev => prev.map(p => p.id === id ? { ...p, isLocked: true, plantId: null, stage: GrowthStage.EMPTY, ripeTicks: 0 } : p));
    setFocusedPlotId(null);
    setActiveDefKey("MARKET_VALUE");
  };

  const plantSeed = (id: number) => {
    if (!selectedSeed || (inventory[selectedSeed] || 0) <= 0) {
        setAdvice("You need to buy seeds in the shop first! 🛍️");
        playSound('alert');
        return;
    }
    setInventory(prev => ({ ...prev, [selectedSeed]: prev[selectedSeed] - 1 }));
    setPlots(prev => prev.map(p => p.id === id ? { ...p, plantId: selectedSeed, stage: GrowthStage.SEED, growthProgress: 0, isWatered: true, ripeTicks: 0 } : p));
    setFocusedPlotId(null);
    playSound('pop');
  };

  const getFlowerHarvestPrice = (plot: Plot) => {
    const plant = PLANTS.find(p => p.id === plot.plantId);
    if (!plant) return 0;
    const decayRate = (weather === Weather.STORM || weather === Weather.HEATWAVE) ? 0.80 : 0.95;
    const multiplier = Math.pow(decayRate, plot.ripeTicks);
    return Math.max(1, Math.floor(plant.baseSellPrice * multiplier));
  };

  const updateMarket = useCallback((mood: MarketMood) => {
    let landMod = 1.0;
    if (mood === MarketMood.HAPPY) landMod = 1.5;
    if (mood === MarketMood.SLEEPY) landMod = 0.6;
    
    const newPrice = Math.floor(BASE_LAND_PRICE * landMod);
    setLandPrice(newPrice);
    setPriceHistory(prev => [...prev, newPrice].slice(-5));
    setActiveDefKey("MARKET_VALUE");

    setCurrentPrices(prev => {
      const next: Record<string, CurrentPrice> = { ...prev };
      PLANTS.forEach(p => {
        let mod = 1.0;
        let isPopular = false;
        let isCheap = false;
        if (mood === MarketMood.HAPPY) { mod = 1.2; isPopular = true; }
        if (mood === MarketMood.SLEEPY) { mod = 0.8; isCheap = true; }
        next[p.id] = {
          seedCost: Math.max(1, Math.floor(p.baseSeedCost * mod)),
          isPopular,
          isCheap
        };
      });
      return next;
    });
  }, []);

  const advanceDay = useCallback(async () => {
    setDay(prev => prev + 1);
    hourRef.current = 0;
    setPlots(prev => prev.map(p => ({ ...p, isWatered: false, hasPests: false })));

    const moodRand = Math.random();
    let newMood = MarketMood.NORMAL;
    if (moodRand < 0.3) newMood = MarketMood.HAPPY;
    else if (moodRand < 0.6) newMood = MarketMood.SLEEPY;
    setMarketMood(newMood);
    updateMarket(newMood);

    const rand = Math.random();
    let cumulative = 0;
    let selectedWeather = Weather.SUNNY;
    for (const w of WEATHER_TYPES) {
      cumulative += w.chance;
      if (rand < cumulative) { selectedWeather = w.type; break; }
    }
    setWeather(selectedWeather);
    if (!isDebt) document.body.className = `sky-${selectedWeather.toLowerCase()}`;

    let eventTriggered: string | null = null;
    if (Math.random() < 0.1) {
        const e = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        eventTriggered = e.name;
        if (e.id === 'party') updateMoney(10, "Mayor's Gift");
    }

    setActiveEvent(eventTriggered);
    const currentPlantIds = plots.filter(p => !p.isLocked && p.plantId).map(p => p.plantId!) as string[];
    const newAdvice = await getFinancialAdvice(money, day + 1, eventTriggered, currentPlantIds, newMood);
    setAdvice(newAdvice);
    setShowAdvice(true); 
  }, [money, plots, day, updateMarket, isDebt]);

  useEffect(() => {
    if (!gameStarted) return;
    tickRef.current = setInterval(() => {
      hourRef.current += 1;
      
      // Every few hours, apply financial penalties/interest
      if (hourRef.current % 4 === 0) {
        if (isDebt) {
          updateMoney(-OVERDRAFT_FEE, "Overdraft Penalty 🛑");
          playSound('alert');
        }
        if (borrowedAmount > 0) {
          updateMoney(-BORROW_INTEREST_FEE, "Loan Interest 🦴");
        }
      }

      if (Math.random() < 0.04) spawnMayor();

      setPlots(prev => prev.map(plot => {
        if (plot.isLocked || !plot.plantId) return plot;
        if (plot.stage === GrowthStage.FLOWER) {
             const newRipeTicks = plot.ripeTicks + 1;
             if (newRipeTicks > plot.ripeTicks && (weather === Weather.STORM || weather === Weather.HEATWAVE)) {
                playSound('decay');
             }
             return { ...plot, ripeTicks: newRipeTicks };
        }
        if (plot.stage === GrowthStage.WITHERED) return plot;
        const plantData = PLANTS.find(p => p.id === plot.plantId);
        let growthSpeed = 1.5;
        if (weather === Weather.RAINY) growthSpeed = 1.8;
        if (weather === Weather.STORM) growthSpeed = 0.5;
        const newProgress = plot.growthProgress + ((1 / (plantData?.growthTime || 10)) * growthSpeed);
        let newStage: GrowthStage = plot.stage;
        if (newProgress >= 1) newStage = GrowthStage.FLOWER;
        else if (newProgress >= 0.6) newStage = GrowthStage.BUD;
        else if (newProgress >= 0.3) newStage = GrowthStage.SPROUT;
        const autoWater = weather === Weather.RAINY || weather === Weather.STORM;
        return { ...plot, growthProgress: newProgress, stage: newStage, isWatered: autoWater ? true : plot.isWatered };
      }));

      if (hourRef.current >= 8) advanceDay();
    }, TICK_SPEED);
    return () => tickRef.current && clearInterval(tickRef.current);
  }, [gameStarted, advanceDay, weather, spawnMayor, isDebt, borrowedAmount]);

  const plotAction = (plotId: number) => {
    playSound('click');
    const plot = plots.find(p => p.id === plotId);
    if (!plot) return;
    if (plot.isLocked) { buyLand(); return; }
    if (plot.stage === GrowthStage.EMPTY) { setFocusedPlotId(focusedPlotId === plotId ? null : plotId); return; }
    if (plot.stage === GrowthStage.FLOWER) {
      const harvestValue = getFlowerHarvestPrice(plot);
      updateMoney(harvestValue, `Harvested ${PLANTS.find(p => p.id === plot.plantId)?.name}`);
      playSound('pop');
      setPlots(prev => prev.map(p => p.id === plotId ? { ...p, plantId: null, stage: GrowthStage.EMPTY, growthProgress: 0, ripeTicks: 0 } : p));
      setActiveDefKey("PROFIT");
    } else if (plot.stage === GrowthStage.WITHERED) {
      playSound('pop');
      setPlots(prev => prev.map(p => p.id === plotId ? { ...p, plantId: null, stage: GrowthStage.EMPTY, growthProgress: 0, ripeTicks: 0 } : p));
    } else if (plot.plantId && !plot.isWatered) {
      playSound('pop');
      setPlots(prev => prev.map(p => p.id === plotId ? { ...p, isWatered: true } : p));
    }
  };

  const handleChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;
    playSound('click');
    const context = `Day ${day}, Money ${money}, Market is ${marketMood}. Borrowed: ${borrowedAmount}. Weather is ${weather}. Debt status: ${isDebt}.`;
    setChatHistory(prev => [...prev, { role: 'user', text: chatMessage }]);
    setChatMessage('');
    setIsChatLoading(true);
    const botText = await chatWithGemini(chatMessage, context);
    setChatHistory(prev => [...prev, { role: 'bot', text: botText }]);
    setIsChatLoading(false);
  };

  const handleViewChange = (v: 'garden' | 'shop' | 'bank') => {
    playSound('click');
    setView(v);
  };

  const handleInstructionToggle = (show: boolean) => {
    playSound('click');
    setShowInstructions(show);
  };

  const currentDef = DEFINITIONS[activeDefKey];

  return (
    <div className="min-h-screen flex flex-col items-center relative overflow-hidden text-[#5a3e2b]">
      {(weather === Weather.RAINY || weather === Weather.STORM) && <div className="rain-overlay" />}
      {weather === Weather.HEATWAVE && <div className="fixed inset-0 bg-orange-400/10 pointer-events-none z-10 animate-pulse" />}
      <div className="absolute bottom-0 w-full h-[35vh] ground-texture z-0 border-t-8 border-[#d4a017]"></div>

      {!gameStarted ? (
        <div className="h-screen w-full relative flex flex-col items-center justify-center p-8 overflow-hidden bg-[#a8d8ff] z-50">
          <div className="absolute bottom-0 w-full h-[30vh] ground-texture z-0 border-t-8 border-[#d4a017]"></div>
          <div className="z-10 flex flex-col items-center">
            <div className="flex items-end gap-4 mb-10 scale-150">
               <div className="text-8xl drop-shadow-[0_10px_0_rgba(0,0,0,0.2)]">👩‍🌾</div>
               <div className="text-6xl animate-bounce">🐕</div>
            </div>
            <div className="text-center relative">
              <h1 className="text-5xl md:text-8xl text-white pixel-text-shadow pixel-text font-bold tracking-tight mb-4 uppercase text-center w-full max-w-5xl leading-tight">
                Cache Me Outside
              </h1>
              <p className="text-white pixel-text-shadow text-sm mt-4 uppercase tracking-widest font-bold">Buy land when it's cheap, sell it when it's popular!</p>
            </div>
            <div className="flex flex-col gap-4 mt-12 w-full max-w-sm">
              <button onClick={() => { playSound('click'); setGameStarted(true); }} className="pixel-button bg-[#b2f2bb] text-[#2d5a27] px-8 py-8 text-xl hover:bg-[#96f2a4] border-black border-4 shadow-[8px_8px_0_#2d5a27]">PLAY NOW 🌸</button>
              <button onClick={() => handleInstructionToggle(true)} className="pixel-button bg-[#ffcc33] text-[#5a3e2b] px-8 py-4 text-xs hover:bg-[#ffbb00] border-black border-4 shadow-[8px_8px_0_#8b7d2f]">HOW TO PLAY</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Floating Knowledge Corner (Left) - Only visible after playing */}
          <div className="fixed left-6 top-1/2 -translate-y-1/2 z-[100] w-56 flex flex-col gap-4 animate-in slide-in-from-left duration-500">
            <div className="floral-panel p-4 border-4 shadow-xl bg-white relative">
              <div className="ribbon-header absolute -top-8 left-2 text-[8px] uppercase font-['Press_Start_2P']">Knowledge Corner</div>
              <div className="flex items-center gap-3 mb-2 pb-2 border-b-2 border-[#5a3e2b]/10">
                <span className="text-3xl">{currentDef.icon}</span>
                <span className="text-[10px] font-bold uppercase font-['Press_Start_2P'] text-[#ff8fb1]">{currentDef.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed italic text-[#3d2b1f]">{currentDef.text}</p>
              <div className="mt-4 flex gap-1 overflow-x-auto pb-1 custom-scrollbar">
                {Object.keys(DEFINITIONS).map(key => (
                  <button 
                    key={key} 
                    onClick={() => setActiveDefKey(key)}
                    className={`w-6 h-6 flex items-center justify-center border-2 border-[#5a3e2b] text-[10px] shrink-0 ${activeDefKey === key ? 'bg-[#ff8fb1] text-white' : 'bg-white'}`}
                  >
                    {DEFINITIONS[key].icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Floating Notifications (Right) */}
          <div className="fixed right-6 top-1/2 -translate-y-1/2 z-[100] flex flex-col gap-4">
            {notifications.map(n => (
              <div key={n.id} className={`floating-feedback flex items-center gap-2 p-3 border-4 border-[#5a3e2b] bg-white shadow-xl animate-in fade-in slide-in-from-right duration-300 ${n.type === 'INCOME' ? 'text-green-600' : 'text-red-500'}`}>
                <span className="text-2xl">{n.type === 'INCOME' ? '⬆️' : '⬇️'}</span>
                <span className="font-bold text-xl font-['Press_Start_2P']">${n.amount}</span>
              </div>
            ))}
          </div>

          {isMayorWalking && (
              <div className="mayor-walk" style={{ left: `${mayorPos}px` }}>
                  <div className="relative">
                      <span className="text-8xl drop-shadow-2xl">🤵‍♂️</span>
                      <div className="absolute -top-12 left-0 bg-white p-2 border-2 border-black rounded text-[10px] font-bold animate-bounce whitespace-nowrap shadow-lg">
                          {mayorMessage.toUpperCase()}!
                      </div>
                  </div>
              </div>
          )}

          {isDebt && (
              <div className="fixed top-24 left-1/2 -translate-x-1/2 bg-red-600 text-white px-8 py-2 border-4 border-black z-[100] pixel-text text-xs shadow-xl animate-pulse">
                  WARNING: IN DEBT! 🛑
              </div>
          )}

          <div className="w-full max-w-5xl px-4 mt-8 flex justify-between items-start z-20">
            <div className="flex gap-4">
              <button onClick={() => { playSound('click'); setGameStarted(false); }} className="floral-panel p-4 flex items-center justify-center border-4 hover:bg-red-50 shadow-md">🏡</button>
              <div className={`floral-panel p-4 flex flex-col items-center gap-1 border-4 relative shadow-md px-6 ${isDebt ? 'border-red-600 shake-debt' : 'border-[#5a3e2b]'}`}>
                <div className={`ribbon-header text-[8px] absolute -top-8 left-4 font-['Press_Start_2P'] ${isDebt ? 'bg-red-600' : ''}`}>WALLET</div>
                <div className="flex items-center gap-2">
                  <PixelIcon type="money" size="md" />
                  <span className={`text-3xl font-bold ${isDebt ? 'text-red-600' : 'text-[#2d5a27]'}`}>{money} 💰</span>
                </div>
                {borrowedAmount > 0 && (
                  <div className="text-[8px] font-bold text-blue-600 uppercase border-t border-black/10 pt-1">Borrowed: {borrowedAmount}💰</div>
                )}
              </div>
            </div>
            
            <div className={`floral-panel p-6 text-right min-w-[320px] border-4 relative shadow-md transition-all ${marketMood === MarketMood.HAPPY ? 'border-green-500 bg-green-50 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : marketMood === MarketMood.SLEEPY ? 'border-red-500 bg-red-50' : 'border-[#5a3e2b]'}`}>
              <div className="ribbon-header text-[10px] absolute -top-8 right-4 font-['Press_Start_2P'] uppercase">TOWN NEWS 📢</div>
              
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-bold uppercase text-gray-500">Weather Effect:</span>
                <span className={`text-sm font-bold uppercase ${weather === Weather.STORM ? 'text-red-600 animate-pulse' : 'text-blue-600'}`}>{weather}</span>
              </div>
              
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-bold uppercase text-gray-500">Market Mood:</span>
                <span className={`text-sm font-bold uppercase ${marketMood === MarketMood.HAPPY ? 'text-green-600 font-black' : marketMood === MarketMood.SLEEPY ? 'text-red-600' : 'text-pink-500'}`}>{marketMood}</span>
              </div>

              <div className="border-t-2 border-black/10 pt-3">
                <div className="flex justify-between items-end">
                  <div className="flex flex-col items-start">
                    <span className="text-[10px] font-bold uppercase text-gray-500">Land Price</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold font-['Press_Start_2P'] ${landPrice > BASE_LAND_PRICE ? 'text-green-600' : landPrice < BASE_LAND_PRICE ? 'text-red-600' : 'text-blue-600'}`}>
                        {landPrice}💰
                      </span>
                    </div>
                  </div>
                  <div className={`flex flex-col items-center p-2 rounded border-2 ${landPrice > BASE_LAND_PRICE ? 'bg-green-100 border-green-500' : landPrice < BASE_LAND_PRICE ? 'bg-red-100 border-red-500' : 'bg-gray-100 border-gray-300'}`}>
                    <span className="text-xl">{landPrice > BASE_LAND_PRICE ? '📈' : landPrice < BASE_LAND_PRICE ? '📉' : '⚖️'}</span>
                    <span className="text-[8px] font-bold uppercase">{landPrice > BASE_LAND_PRICE ? 'Selling Win!' : landPrice < BASE_LAND_PRICE ? 'Buy Land!' : 'Normal'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 w-full max-w-5xl flex flex-col items-center justify-center z-10 pt-4 pb-48">
            {view === 'garden' && (
              <div className="grid grid-cols-5 gap-4 p-8 bg-white/30 rounded-3xl border-4 border-white/50 backdrop-blur-sm shadow-xl relative">
                  {plots.map(plot => (
                  <div key={plot.id} className="plot-container cursor-pointer group relative" onClick={() => plotAction(plot.id)}>
                      <div className={`soil-patch ${plot.isLocked ? 'bg-gray-400 opacity-40' : ''} ${plot.isWatered ? 'soil-watered' : ''} ${focusedPlotId === plot.id ? 'ring-4 ring-white shadow-[0_0_20px_white]' : ''}`}>
                      <div className="soil-content">
                          {plot.isLocked ? (
                              <div className="flex flex-col items-center">
                                  <span className="text-3xl">🔒</span>
                                  <span className="text-[8px] font-bold text-black mt-1">COST: {landPrice}💰</span>
                              </div>
                          ) : plot.plantId ? (
                            <div className="flex flex-col items-center relative">
                                {plot.stage === GrowthStage.FLOWER && (
                                    <div className={`absolute -top-12 text-[8px] font-bold border-2 border-black p-1 whitespace-nowrap z-50 shadow-md ${plot.ripeTicks > 2 ? 'bg-red-600 text-white' : plot.ripeTicks > 0 ? 'bg-orange-400 text-white' : 'bg-white'} animate-bounce`}>
                                        VALUE: {getFlowerHarvestPrice(plot)}💰
                                    </div>
                                )}
                                <span className={`text-6xl drop-shadow-lg transition-all ${plot.ripeTicks > 4 ? 'grayscale sepia brightness-50' : plot.ripeTicks > 2 ? 'saturate-50 brightness-75' : ''}`}>
                                    {plot.stage === GrowthStage.SEED ? '🟤' : 
                                     plot.stage === GrowthStage.SPROUT ? '🌱' : 
                                     plot.stage === GrowthStage.BUD ? '🌿' : 
                                     plot.stage === GrowthStage.FLOWER ? (PLANTS.find(p => p.id === plot.plantId)?.icon || '🌸') : '🥀'}
                                </span>
                            </div>
                          ) : (
                              <div className="flex flex-col items-center text-4xl opacity-20 group-hover:opacity-40">➕</div>
                          )}
                      </div>
                      </div>

                      {focusedPlotId === plot.id && !plot.isLocked && !plot.plantId && (
                          <div className="absolute -top-24 left-1/2 -translate-x-1/2 bg-white border-4 border-[#5a3e2b] p-2 flex gap-2 z-[200] shadow-2xl animate-in zoom-in duration-200 rounded-lg whitespace-nowrap">
                              <button onClick={(e) => { e.stopPropagation(); plantSeed(plot.id); }} className="bg-green-400 hover:bg-green-500 border-2 border-black p-2 flex flex-col items-center rounded">
                                 <span className="text-2xl">{PLANTS.find(p => p.id === selectedSeed)?.icon || '🌱'}</span>
                                 <span className="text-[8px] font-bold uppercase mt-1">Plant</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); sellLand(plot.id); }} className={`bg-yellow-400 hover:bg-yellow-500 border-2 border-black p-2 flex flex-col items-center rounded ${marketMood === MarketMood.HAPPY ? 'ring-4 ring-green-500 scale-110 shadow-lg' : ''}`}>
                                 <span className="text-2xl">💰</span>
                                 <span className="text-[8px] font-bold uppercase mt-1">Sell ({Math.floor(landPrice * 0.95)})</span>
                              </button>
                              <button onClick={(e) => { e.stopPropagation(); playSound('click'); setFocusedPlotId(null); }} className="bg-red-400 hover:bg-red-500 border-2 border-black px-2 flex items-center rounded text-white font-bold">X</button>
                          </div>
                      )}
                  </div>
                  ))}
              </div>
            )}

            {view === 'shop' && (
              <div className="w-full max-w-4xl floral-panel p-10 z-30 animate-in fade-in zoom-in duration-300">
                 <div className="ribbon-header absolute left-1/2 -translate-x-1/2 -top-6 text-xs uppercase font-bold">The Town Market 🛒</div>
                 <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-4 mt-4 custom-scrollbar">
                  <div className={`p-4 border-4 flex flex-col items-center shadow-lg transform hover:scale-105 transition-transform ${marketMood === MarketMood.HAPPY ? 'bg-green-100 border-green-500' : 'bg-blue-50 border-blue-500'}`}>
                      <span className="text-5xl mb-2">🌳</span>
                      <span className="text-xs font-bold uppercase mb-1">Buy Land Patch</span>
                      <div className="flex flex-col items-center mb-4 text-[9px] font-bold">
                          <span className={`text-blue-500`}>Buy Price: {landPrice} 💰</span>
                          <span className={`text-green-600`}>Sell Value: {Math.floor(landPrice * 0.95)} 💰</span>
                      </div>
                      <button onClick={() => { playSound('click'); buyLand(); }} className={`w-full py-2 pixel-button text-[8px] border-2 border-black bg-blue-300`}>BUY LAND</button>
                  </div>
                  {PLANTS.map(plant => (
                      <div key={plant.id} className="bg-white p-4 border-4 border-[#5a3e2b] flex flex-col items-center hover:bg-pink-50 transition-colors shadow-sm">
                        <span className="text-5xl mb-2">{plant.icon}</span>
                        <span className="text-xs font-bold uppercase mb-1">{plant.name}</span>
                        <div className="flex flex-col items-center mb-4 text-[9px] font-bold">
                          <span className="text-blue-500 font-bold">Buy Seed: {currentPrices[plant.id].seedCost} 💰</span>
                        </div>
                        <button onClick={() => { updateMoney(-currentPrices[plant.id].seedCost, `Bought Seed: ${plant.name}`); setInventory(prev => ({ ...prev, [plant.id]: (prev[plant.id] || 0) + 1 })); }} className={`w-full py-2 pixel-button text-[8px] border-2 border-black bg-[#b2f2bb] hover:bg-[#96f2a4]`}>BUY SEEDS</button>
                      </div>
                  ))}
                </div>
                <button onClick={() => handleViewChange('garden')} className="w-full mt-8 bg-[#5a3e2b] text-white py-3 text-xs font-bold uppercase">Back to Town</button>
              </div>
            )}

            {view === 'bank' && (
              <div className="w-full max-w-4xl floral-panel p-10 z-30 animate-in slide-in-from-bottom duration-300">
                 <div className="ribbon-header absolute left-1/2 -translate-x-1/2 -top-6 text-xs uppercase font-bold">Town Bank 🏦</div>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="bg-white p-6 border-4 border-[#5a3e2b] flex flex-col items-center shadow-lg">
                       <span className="text-5xl mb-4">💳</span>
                       <h3 className="text-[10px] font-bold uppercase mb-4 font-['Press_Start_2P']">Borrowing Center</h3>
                       <div className="space-y-4 w-full">
                          <div className="flex justify-between text-[10px] font-bold">
                             <span>Borrowed:</span>
                             <span className="text-blue-600 font-['Press_Start_2P']">{borrowedAmount}💰</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold">
                             <span>Limit:</span>
                             <span className="text-gray-400 font-['Press_Start_2P']">{BORROW_LIMIT}💰</span>
                          </div>
                          <div className="flex justify-between text-[10px] font-bold border-t border-black/10 pt-2">
                             <span>Daily Fee:</span>
                             <span className="text-red-500 font-['Press_Start_2P']">-{BORROW_INTEREST_FEE}💰</span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-4">
                             <button onClick={handleBorrow} className="bg-blue-400 border-2 border-black p-2 text-[8px] font-bold hover:bg-blue-500">BORROW 50</button>
                             <button onClick={handleRepay} className="bg-green-400 border-2 border-black p-2 text-[8px] font-bold hover:bg-green-500">REPAY 50</button>
                          </div>
                          <p className="text-[8px] text-gray-500 italic mt-4">* Borrowing is cheaper than having a negative balance (Overdraft)!</p>
                       </div>
                    </div>

                    <div className="bg-white p-6 border-4 border-[#5a3e2b] h-[300px] flex flex-col shadow-lg overflow-hidden">
                       <h3 className="text-[10px] font-bold uppercase mb-4 font-['Press_Start_2P'] text-center">Coin History</h3>
                       <div className="flex-1 overflow-y-auto custom-scrollbar">
                          {ledger.map((l, i) => (
                            <div key={i} className="flex justify-between text-xs py-2 border-b-2 border-gray-100 italic">
                              <span>D{l.day}: {l.description}</span>
                              <span className={l.type === 'INCOME' ? 'text-green-600' : 'text-red-600 font-bold'}>{l.type === 'INCOME' ? '+' : '-'}{l.amount}</span>
                            </div>
                          ))}
                          {ledger.length === 0 && <p className="text-center py-10 opacity-40 text-xs">No history yet!</p>}
                       </div>
                    </div>
                 </div>

                 <button onClick={() => handleViewChange('garden')} className="w-full mt-8 bg-[#5a3e2b] text-white py-3 text-xs font-bold uppercase">Back to Town</button>
              </div>
            )}
          </div>

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-white/95 p-4 border-4 border-[#5a3e2b] z-50 shadow-[8px_8px_0_rgba(0,0,0,0.2)]">
            <button onClick={() => handleViewChange('garden')} className={`p-4 border-4 border-[#5a3e2b] ${view === 'garden' ? 'bg-[#ff8fb1]' : 'bg-gray-100'} hover:scale-105 transition-transform`}>🏡</button>
            <div className="w-1 h-12 bg-[#5a3e2b]/20" />
            {PLANTS.map(p => (
              <button key={p.id} onClick={() => { playSound('click'); setSelectedSeed(p.id); }} className={`p-3 border-4 border-[#5a3e2b] relative transition-all ${selectedSeed === p.id ? 'bg-white scale-125 shadow-lg -translate-y-2' : 'bg-gray-50 opacity-60'}`}>
                <span className="text-3xl">{p.icon}</span>
                <span className="absolute -top-3 -right-3 text-[10px] bg-[#ff8fb1] text-white px-2 py-1 border-2 border-[#5a3e2b] font-bold font-['Press_Start_2P']">{inventory[p.id] || 0}</span>
              </button>
            ))}
            <div className="w-1 h-12 bg-[#5a3e2b]/20" />
            <button onClick={() => handleViewChange('shop')} className="p-4 bg-[#a8d8ff] border-4 border-[#5a3e2b] text-2xl hover:scale-105 transition-transform">🛍️</button>
            <button onClick={() => handleViewChange('bank')} className="p-4 bg-[#ffcc33] border-4 border-[#5a3e2b] text-2xl hover:scale-105 transition-transform">🏦</button>
          </div>

          {showAdvice && (
            <div className="fixed bottom-32 left-8 right-8 flex justify-center z-40 animate-in slide-in-from-bottom duration-500">
              <div className={`floral-panel p-6 flex gap-6 max-w-2xl border-4 items-center relative shadow-xl ${isDebt ? 'border-red-600' : ''}`}>
                <button onClick={() => { playSound('click'); setShowAdvice(false); }} className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white border-4 border-[#5a3e2b] flex items-center justify-center font-bold">X</button>
                <div className="flex flex-col items-center shrink-0">
                  <span className="text-6xl">{isDebt ? '😨' : marketMood === MarketMood.HAPPY ? '🤩' : '🐕'}</span>
                  <span className="text-[10px] font-bold mt-2 font-['Press_Start_2P'] uppercase">Cache</span>
                </div>
                <div className="border-l-4 border-[#5a3e2b]/20 pl-6">
                  <h4 className="text-[10px] text-pink-500 font-bold mb-2 uppercase font-['Press_Start_2P']">Smart Puppy Tip</h4>
                  <p className="text-lg italic text-[#3d2b1f] font-bold">"{isDebt ? "Oh no! We are in debt! Borrowing money at the Bank 🏦 is cheaper than a negative balance!" : advice}"</p>
                </div>
              </div>
            </div>
          )}

          {showDebtWarning && (
            <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[500] p-4">
              <div className="floral-panel w-full max-md:p-6 p-10 relative animate-in zoom-in duration-300 border-red-600">
                <div className="ribbon-header absolute left-1/2 -translate-x-1/2 -top-6 text-xs font-bold uppercase bg-red-600">DEBT ALERT 🛑</div>
                <div className="text-center space-y-6">
                  <span className="text-8xl">😨</span>
                  <p className="text-sm font-bold text-red-600 uppercase font-['Press_Start_2P']">Being in Debt is risky!</p>
                  <p className="text-xs leading-relaxed text-[#5a3e2b]">
                    When your coins go below 0, the town charges a high <b>OVERDRAFT FEE</b> of -{OVERDRAFT_FEE}💰 every few hours!
                  </p>
                  <p className="text-xs leading-relaxed text-[#5a3e2b]">
                    Go to the <b>Bank 🏦</b> to borrow money instead. The borrowing fee is much smaller than the overdraft penalty!
                  </p>
                  <button onClick={() => { playSound('click'); setShowDebtWarning(false); }} className="w-full bg-red-600 text-white py-4 text-xs font-bold uppercase pixel-button shadow-[4px_4px_0_black]">I UNDERSTAND!</button>
                </div>
              </div>
            </div>
          )}
          
          {!showAdvice && (
            <button onClick={() => { playSound('click'); setShowAdvice(true); }} className="fixed bottom-36 left-8 bg-[#ff8fb1] border-4 border-[#5a3e2b] p-4 rounded-full z-30 shadow-lg hover:scale-110 transition-transform">🐕</button>
          )}

          <div className="fixed bottom-6 right-6 z-[200]">
            {!isChatOpen ? (
              <button onClick={() => { playSound('click'); setIsChatOpen(true); }} className="w-16 h-16 bg-blue-400 border-4 border-black shadow-[4px_4px_0_black] flex items-center justify-center text-4xl hover:scale-110 transition-transform animate-pulse">💬</button>
            ) : (
              <div className="floral-panel w-72 md:w-80 h-[480px] flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-300">
                <div className="flex justify-between items-center mb-2 pb-2 border-b-2 border-gray-200">
                  <span className="text-[10px] font-bold font-['Press_Start_2P'] uppercase">Ask Cache</span>
                  <button onClick={() => { playSound('click'); setIsChatOpen(false); }} className="bg-red-500 text-white px-2 py-1 border-2 border-black text-[8px]">X</button>
                </div>
                <div className="flex-1 overflow-y-auto mb-2 space-y-2 pr-2 custom-scrollbar">
                  <div className="chat-bubble bg-pink-50 self-start">Woof! Do you want to know how borrowing works or how to beat Mayor Grumpy? 🦴</div>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={`chat-bubble ${msg.role === 'user' ? 'bg-blue-50 self-end ml-auto' : 'bg-pink-50 self-start mr-auto'}`}>{msg.text}</div>
                  ))}
                  {isChatLoading && <div className="text-[8px] animate-pulse font-bold">Cache is thinking...</div>}
                </div>
                <form onSubmit={handleChat} className="flex gap-2">
                  <input value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} placeholder="What is an overdraft fee?" className="flex-1 text-[10px] p-2 border-2 border-[#5a3e2b] outline-none rounded font-bold" />
                  <button type="submit" className="bg-[#b2f2bb] border-2 border-black p-2 rounded">🐾</button>
                </form>
              </div>
            )}
          </div>
        </>
      )}
      {showInstructions && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4">
          <div className="floral-panel w-full max-w-2xl p-10 relative animate-in zoom-in duration-300">
            <div className="ribbon-header absolute left-1/2 -translate-x-1/2 -top-6 text-xs font-bold uppercase">Garden Rules</div>
            <button onClick={() => handleInstructionToggle(false)} className="absolute -top-4 -right-4 w-10 h-10 bg-red-500 text-white border-4 border-[#5a3e2b] flex items-center justify-center font-bold">X</button>
            <div className="space-y-6 text-sm leading-relaxed overflow-y-auto max-h-[60vh] pr-4 custom-scrollbar">
              <section>
                <h3 className="text-[#ff8fb1] font-bold mb-2 uppercase font-['Press_Start_2P'] text-[10px]">💰 Land Trading</h3>
                <p>Garden patches are worth more when the market is "Happy." Check Town News to see if land prices are going UP! 📈</p>
              </section>
              <section>
                <h3 className="text-[#ff8fb1] font-bold mb-2 uppercase font-['Press_Start_2P'] text-[10px]">🏦 Borrowing & Debt</h3>
                <p>If you run out of coins (below 0), you enter <b>Overdraft</b>. This is expensive! Go to the Bank 🏦 to borrow coins at a lower fee instead.</p>
              </section>
              <section>
                <h3 className="text-[#ff8fb1] font-bold mb-2 uppercase font-['Press_Start_2P'] text-[10px]">🛑 Debt Alert</h3>
                <p>If you stay in debt too long, the Overdraft Fees will eat your coins faster. Sell land or harvest flowers to stay positive! 🦴</p>
              </section>
            </div>
            <button onClick={() => handleInstructionToggle(false)} className="w-full mt-8 bg-[#5a3e2b] text-white py-4 text-xs font-bold uppercase">Let's Grow!</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
