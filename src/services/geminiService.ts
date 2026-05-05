import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface GameContext {
  townName: string;
  players: { name: string; role: string; isAlive: boolean; isAI: boolean }[];
  history: string[];
}

export async function generateNarrative(context: GameContext, prompt: string) {
  const systemInstruction = `
    You are the Game Master for a dark, suspenseful Mafia game set in ${context.townName}. 
    Your tone is immersive, mysterious, and slightly gothic. 
    Current players: ${context.players.map(p => `${p.name} (${p.isAlive ? 'Alive' : 'Dead'})`).join(", ")}.
    Format your response as a dramatic narration.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
    config: {
      systemInstruction,
    }
  });

  return response.text || "The fog thickens, obscuring the truth...";
}

export async function generateAIPlayerTalk(context: GameContext, player: { name: string; role: string }, dayTopic: string) {
  const systemInstruction = `
    You are ${player.name}, a player in a game of Mafia. 
    You are ${player.role === 'Mafia' ? 'the secret Mafia (playing cautiously)' : 'a innocent townsfolk'}.
    The group is discussing: ${dayTopic}.
    Provide a short, impactful contribution to the discussion (1-3 sentences) in your specific persona's voice.
    Persona: ${player.name} is ${player.name === 'Silas' ? 'nervous and stuttering' : player.name === 'Arthur' ? 'logical and cold' : player.name === 'Eleanor' ? 'passionate and defensive' : 'stoic'}.
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: "Contribute to the secret discussion/debate.",
    config: {
      systemInstruction,
    }
  });

  return response.text || "I... I don't know who to trust.";
}
