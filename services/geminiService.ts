
import { GoogleGenAI } from "@google/genai";

export const getFinancialAdvice = async (
  money: number, 
  day: number, 
  event: string | null, 
  currentPlants: string[],
  marketMood: string
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Context: A gardening game for a 7-year-old. Day ${day}, Money ${money}, Market is ${marketMood}. 
      Task: Give ONE very simple tip about money. Include tips about "Buying and Selling Land" if land is cheap or expensive. 
      Use words like 'Invest', 'Saving', 'Price', 'Good Deal'. 
      Keep it very friendly. Max 12 words. Perspective: Cache the happy farm dog.`,
      config: { temperature: 0.9 }
    });
    return response.text?.trim() || "Buy your garden patches when they are cheap! 🐾";
  } catch (error) {
    return "Every coin saved is a cookie for later! 🦴";
  }
};

export const chatWithGemini = async (userMessage: string, context: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are Cache, a friendly dog finance coach for 7-year-olds. 
      Context: ${context}. 
      If the user asks about the Evil Mayor, call him "Mayor Grumpy" and say he's just a bit cranky.
      If they ask about selling land, say it's like a big trade.
      Keep answers very short and use emojis.`,
      config: { temperature: 0.7 }
    });
    return response.text?.trim() || "Woof! You're a smart gardener! 🌸";
  } catch (error) {
    return "I'm busy burying a bone! Ask me again? 🐕";
  }
};
