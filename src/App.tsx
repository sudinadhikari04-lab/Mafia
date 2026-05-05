/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Skull, Shield, User, Ghost, Send, Users, Moon, Sun, AlertCircle } from 'lucide-react';
import { generateNarrative, generateAIPlayerTalk } from './services/geminiService';

type Role = 'Mafia' | 'Doctor' | 'Villager';
type Phase = 'Setup' | 'RoleReveal' | 'Night' | 'Day' | 'Vote' | 'GameOver';

interface Player {
  id: string;
  name: string;
  role: Role;
  isAlive: boolean;
  isAI: boolean;
  votesAgainst: number;
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('Setup');
  const [numHumans, setNumHumans] = useState<number>(3);
  const [numAI, setNumAI] = useState<number>(2);
  const [humanNames, setHumanNames] = useState<string[]>(["You", "Resident 2", "Resident 3"]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [activeHumanIndex, setActiveHumanIndex] = useState(0);
  const [isPrivateVisible, setIsPrivateVisible] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [narrative, setNarrative] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [nightAction, setNightAction] = useState<{ targetId?: string; saveId?: string }>({});
  const [nightPhase, setNightPhase] = useState<'Sleep' | 'Mafia' | 'Doctor' | 'End'>('Sleep');
  const [isNarrating, setIsNarrating] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const TOWN_NAME = "Hemlock Falls";

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // Slightly slower for dramatic effect
    utterance.pitch = 0.8; // Lower pitch for dark atmosphere
    window.speechSynthesis.speak(utterance);
  };

  const handlePrivateProceed = () => {
    if (phase === 'Night') {
      if (nightPhase === 'Sleep') {
        setCountdown(5);
        speak("5... 4... 3... 2... 1...");
      } else {
        setIsPrivateVisible(false);
      }
    } else {
      setIsPrivateVisible(false);
    }
  };

  useEffect(() => {
    if (phase === 'Night' && nightPhase === 'Sleep' && countdown !== null) {
      if (countdown > 0) {
        const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
        return () => clearTimeout(timer);
      } else {
        setCountdown(null);
        setNightPhase('Mafia');
        const mafiaTurn = "Mafia... wake up silently. Look upon your neighbors and cast your silent vote for tonight's victim.";
        setNarrative(mafiaTurn);
      }
    }
  }, [countdown, phase, nightPhase]);

  useEffect(() => {
    if (narrative && isVoiceEnabled) {
      speak(narrative);
    }
  }, [narrative, isVoiceEnabled]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, narrative]);

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, msg]);
  };

    const handleSetup = async () => {
    let effectiveNumAI = numAI;
    // Compulsory AI for 2p mode
    if (numHumans === 2 && numAI === 0) {
      effectiveNumAI = 1;
      setNumAI(1);
    }

    const totalPlayers = numHumans + effectiveNumAI;
    if (totalPlayers < 3) {
      alert("At least 3 souls are required to start the ritual.");
      return;
    }
    setLoading(true);
    const defaultAINames = ["Silas", "Arthur", "Eleanor", "Marcus", "Julian", "Victor", "Isabella", "Clara", "Gideon", "Mina"];
    const filteredHumanNames = humanNames.filter(name => name.trim() !== "");
    const finalNames = [...filteredHumanNames];
    
    while (finalNames.length < totalPlayers) {
      finalNames.push(defaultAINames[finalNames.length - filteredHumanNames.length]);
    }

    const numMafia = totalPlayers >= 8 ? 2 : 1;
    const baseRoles: Role[] = Array(numMafia).fill('Mafia')
      .concat(['Doctor'])
      .concat(Array(Math.max(0, totalPlayers - numMafia - 1)).fill('Villager'));
    
    let shuffledRoles = [...baseRoles].sort(() => Math.random() - 0.5);
    
    let humanMafiaCount = 0;
    for (let i = 0; i < numHumans; i++) {
        if (shuffledRoles[i] === 'Mafia') humanMafiaCount++;
    }

    if (humanMafiaCount < numMafia) {
        let aiMafiaIndices = [];
        for (let i = numHumans; i < totalPlayers; i++) {
            if (shuffledRoles[i] === 'Mafia') aiMafiaIndices.push(i);
        }

        let humanVillagerIndices = [];
        for (let i = 0; i < numHumans; i++) {
            if (shuffledRoles[i] === 'Villager' || shuffledRoles[i] === 'Doctor') humanVillagerIndices.push(i);
        }

        while (aiMafiaIndices.length > 0 && humanVillagerIndices.length > 0) {
            const aiIdx = aiMafiaIndices.pop()!;
            const humanIdx = humanVillagerIndices.pop()!;
            [shuffledRoles[aiIdx], shuffledRoles[humanIdx]] = [shuffledRoles[humanIdx], shuffledRoles[aiIdx]];
        }
    }

    const newPlayers: Player[] = finalNames.map((name, i) => ({
      id: i.toString(),
      name,
      role: shuffledRoles[i] as Role,
      isAlive: true,
      isAI: i >= numHumans,
      votesAgainst: 0
    }));

    setPlayers(newPlayers);
    setPhase('RoleReveal');
    setActiveHumanIndex(0);
    setIsPrivateVisible(true);
    setLoading(false);
    
    const intro = await generateNarrative({ townName: TOWN_NAME, players: newPlayers, history: [] }, 
      `The sun sets over ${TOWN_NAME}. ${totalPlayers} souls gather, unaware that the shadow of death walks among them. Introduce the players and set the atmosphere.`);
    setNarrative(intro);
  };

  const startNight = async () => {
    setPhase('Night');
    setNightAction({});
    setNightPhase('Sleep');
    setIsPrivateVisible(true);
    
    const nightIntro = "The clock strikes midnight. The air grows cold, and a heavy silence falls over the town. Everyone... close your eyes. Place the device in the center of the circle so it is reachable by all. Do not move. Do not speak. The night has begun.";
    setNarrative(nightIntro);
  };

  const handleMafiaTarget = (id: string) => {
    setNightAction(prev => ({ ...prev, targetId: id }));
    
    const doctor = players.find(p => p.role === 'Doctor');
    if (doctor && doctor.isAlive) {
        setNightPhase('Doctor');
        const doctorTurn = "Mafia, close your eyes once more. Doctor... open your eyes and choose one soul to shield from the darkness.";
        setNarrative(doctorTurn);
        if (doctor.isAI) {
            // Handle AI Doctor logic
            const alivePlayers = players.filter(p => p.isAlive);
            const randomSave = alivePlayers[Math.floor(Math.random() * alivePlayers.length)].id;
            setNightAction(prev => ({ ...prev, saveId: randomSave }));
            setTimeout(() => resolveNight({ targetId: id, saveId: randomSave }), 3000);
        } else {
            setIsPrivateVisible(true);
        }
    } else {
        resolveNight({ targetId: id, saveId: nightAction.saveId });
    }
  };

  const handleDoctorSave = (id: string) => {
    setNightAction(prev => ({ ...prev, saveId: id }));
    resolveNight({ targetId: nightAction.targetId, saveId: id });
  };

  const resolveNight = async (actions: { targetId?: string; saveId?: string }) => {
    setLoading(true);
    let victimId: string | null = actions.targetId || null;
    if (actions.targetId === actions.saveId) {
      victimId = null;
    }

    const updatedPlayers = players.map(p => {
      if (victimId && p.id === victimId) return { ...p, isAlive: false };
      return p;
    });

    setPlayers(updatedPlayers);
    setPhase('Day');

    const resultNarrative = await generateNarrative(
      { townName: TOWN_NAME, players: updatedPlayers, history: logs },
      victimId ? `Someone died tonight. Identify the victim as ${players.find(p => p.id === victimId)?.name}. Narration should be dramatic.` : "No one died tonight. The Doctor performed a miracle."
    );
    setNarrative(resultNarrative);
    setLoading(false);
    checkWinCondition(updatedPlayers);
  };

  const startDiscussion = async () => {
    setIsNarrating(true);
    addLog("--- The Discussion Begins ---");
    for (const p of players) {
      if (p.isAlive && p.isAI) {
        const talk = await generateAIPlayerTalk({ townName: TOWN_NAME, players, history: logs }, p, "Who is the Mafia among us?");
        addLog(`${p.name}: "${talk}"`);
        if (isVoiceEnabled) speak(`${p.name} says: ${talk}`);
        // Small delay between speakers
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    setIsNarrating(false);
    setPhase('Vote');
  };

  const handleVote = async (targetId: string) => {
    setLoading(true);
    const updatedPlayers = players.map(p => {
      if (p.id === targetId) return { ...p, isAlive: false };
      return p;
    });
    setPlayers(updatedPlayers);
    
    const votedOut = players.find(p => p.id === targetId);
    addLog(`The town has spoken. ${votedOut?.name} was eliminated.`);
    
    const voteResult = await generateNarrative(
      { townName: TOWN_NAME, players: updatedPlayers, history: logs },
      `${votedOut?.name} was voted out. Reveal their role was ${votedOut?.role}.`
    );
    setNarrative(voteResult);
    setLoading(false);
    
    if (!checkWinCondition(updatedPlayers)) {
      setPhase('Day'); // Actually means go to next night, but UI shows Day next
    }
  };

  const checkWinCondition = (currentPlayers: Player[]) => {
    const mafiaCount = currentPlayers.filter(p => p.isAlive && p.role === 'Mafia').length;
    const innocentCount = currentPlayers.filter(p => p.isAlive && p.role !== 'Mafia').length;

    if (mafiaCount === 0) {
      setPhase('GameOver');
      setNarrative("The last shadow has been cast out. The Villagers have reclaimed Hemlock Falls!");
      return true;
    }
    if (mafiaCount >= innocentCount) {
      setPhase('GameOver');
      setNarrative("The shadows have swallowed the town. The Mafia reigns supreme in Hemlock Falls.");
      return true;
    }
    return false;
  };

  const currentHuman = players[activeHumanIndex];

  return (
    <div className="min-h-screen bg-void text-gray-200 font-serif selection:bg-blood selection:text-white p-4 md:p-8 flex flex-col items-center">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full mb-8 text-center"
      >
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter text-gray-100 flex items-center justify-center gap-3">
          <Skull className="text-blood w-10 h-10" />
          Hemlock Falls
        </h1>
        <div className="flex items-center justify-center gap-4 mt-4">
          <p className="text-gray-500 italic">A Town of Secrets and Shadows</p>
          <button 
            onClick={() => {
              setIsVoiceEnabled(!isVoiceEnabled);
              if (!isVoiceEnabled) speak("Voice narration enabled.");
              else window.speechSynthesis.cancel();
            }}
            className={`p-2 rounded-full border transition-all ${isVoiceEnabled ? 'bg-blood/20 border-blood text-blood' : 'border-gray-800 text-gray-600'}`}
            title={isVoiceEnabled ? "Disable Voice" : "Enable Voice"}
          >
            {isVoiceEnabled ? <Send className="w-4 h-4 rotate-90" /> : <Ghost className="w-4 h-4" />}
          </button>
        </div>
      </motion.div>

      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Left Column: Player List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 backdrop-blur-sm">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b border-gray-800 pb-2">
              <Users className="w-5 h-5 text-blood" />
              Residents
            </h2>
            <div className="space-y-3">
              {players.map(player => (
                <div 
                  key={player.id} 
                  className={`flex items-center justify-between p-2 rounded-lg transition-colors ${player.isAlive ? 'bg-gray-800/30' : 'opacity-40 grayscale'}`}
                >
                  <div className="flex items-center gap-3">
                    {player.isAlive ? (
                      <User className={`w-4 h-4 ${player.isAI ? 'text-gray-500' : 'text-blue-400'}`} />
                    ) : (
                      <Ghost className="w-4 h-4 text-red-900" />
                    )}
                    <span className={`font-medium ${!player.isAlive && 'line-through'}`}>{player.name}</span>
                  </div>
                </div>
              ))}
              {players.length === 0 && <p className="text-sm text-gray-600 text-center py-4 italic">No residents found...</p>}
            </div>
          </div>
        </div>

        {/* Center/Right Column: Main Game Area */}
        <div className="lg:col-span-2 flex flex-col gap-4 h-full min-h-[600px]">
          {/* Narrative / Game Master Box */}
          <div className="flex-1 bg-gray-900/80 border border-gray-800 rounded-xl shadow-2xl p-6 flex flex-col overflow-hidden relative">
            <div className="absolute top-0 right-0 p-3 opacity-20 pointer-events-none">
               {phase === 'Night' ? <Moon className="w-20 h-20" /> : <Sun className="w-20 h-20" />}
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar" ref={scrollRef}>
              <AnimatePresence mode="wait">
                <motion.div 
                  key={narrative}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="mb-6"
                >
                  <p className="text-xl leading-relaxed text-gray-300 whitespace-pre-wrap drop-shadow-sm font-light italic">
                    {narrative || "The fog rolls in over Hemlock Falls..."}
                  </p>
                </motion.div>
              </AnimatePresence>

              {logs.length > 0 && (
                <div className="space-y-2 pt-4 border-t border-gray-800">
                  {logs.map((log, i) => (
                    <p key={i} className="text-sm font-mono text-gray-500 opacity-80">
                      {log}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {loading && (
              <div className="absolute inset-0 bg-void/40 backdrop-blur-sm flex items-center justify-center rounded-xl z-50">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-blood border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs uppercase tracking-widest text-blood font-bold">The shadows are shifting...</span>
                </div>
              </div>
            )}
          </div>

          {/* Action Box */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 relative overflow-hidden">
            
            {/* Private Shield Overlay */}
            <AnimatePresence>
              {isPrivateVisible && (
                <motion.div 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-void/95 backdrop-blur-xl z-[100] flex flex-col items-center justify-center p-8 text-center"
                >
                  <Shield className="w-24 h-24 text-blood mb-8 animate-pulse" />
                  <h3 className="text-4xl font-bold mb-6 tracking-tight font-serif italic">The Veiled Moment</h3>
                  <div className="max-w-md w-full bg-gray-900/50 border border-gray-800 rounded-2xl p-8 mb-10 shadow-2xl">
                    <p className="text-gray-300 text-xl leading-relaxed italic">
                      {phase === 'RoleReveal' 
                        ? `The shadows are gathering. Each player must now face their destiny. Pass the device to ${players[activeHumanIndex]?.name}.`
                        : phase === 'Night' && nightPhase === 'Sleep'
                        ? (countdown !== null 
                            ? "The town is falling into a deep sleep. Close your eyes and stay perfectly still..." 
                            : "Place the device in the center of the circle. Everyone must now sleep.")
                        : phase === 'Night' && nightPhase === 'Mafia'
                        ? "The shadows stir. The Mafia must now identify themselves silently and choose their mark."
                        : phase === 'Night' && nightPhase === 'Doctor'
                        ? "A protector awakes. The Doctor must now identify themselves silently and choose a life to save."
                        : "The night continues its slow creep."}
                    </p>
                  </div>
                  
                  {countdown !== null ? (
                    <div className="text-8xl font-bold text-blood font-mono animate-bounce mb-8">
                      {countdown}
                    </div>
                  ) : (
                    <button 
                      onClick={handlePrivateProceed}
                      className="px-12 py-5 bg-blood hover:bg-red-700 text-white font-bold rounded-xl uppercase tracking-[0.2em] transition-all shadow-2xl shadow-blood/40 hover:scale-105 active:scale-95"
                    >
                      {phase === 'Night' 
                        ? (nightPhase === 'Sleep' ? "Everyone is Asleep" : 
                           nightPhase === 'Mafia' ? "Mafia: Wake up silently... Press to start voting" : 
                           nightPhase === 'Doctor' ? "Doctor: Wake up silently... Press to start saving" :
                           `Proceed as ${nightPhase}`) 
                        : `I am ${players[activeHumanIndex]?.name}`}
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {phase === 'Setup' && (
              <div className="flex flex-col items-center gap-4">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-100 italic font-serif">The Gathering</h2>
                  <p className="text-gray-500 text-sm">How many souls will face the shadows?</p>
                </div>
                
                <div className="w-full space-y-6">
                  {/* Human Selection */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-1">Human Participants</p>
                    <div className="flex flex-wrap justify-start gap-2 max-w-xs">
                      {[2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                        <button 
                          key={n}
                          onClick={() => {
                            setNumHumans(n);
                            const names = Array(n).fill("").map((_, i) => i === 0 ? (humanNames[0] || "You") : (humanNames[i] || `Resident ${i+1}`));
                            setHumanNames(names);
                            if (n === 2 && numAI === 0) setNumAI(1);
                          }}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold transition-all text-xs ${numHumans === n ? 'bg-blood border-blood text-white scale-110 shadow-lg shadow-blood/40' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* AI Selection */}
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-bold ml-1">AI Residents</p>
                    <div className="flex flex-wrap justify-start gap-2 max-w-xs">
                      {[0, 1, 2, 3, 4, 5].map(n => (
                        <button 
                          key={n}
                          onClick={() => setNumAI(n)}
                          disabled={numHumans === 2 && n === 0}
                          className={`w-9 h-9 rounded-full border flex items-center justify-center font-bold transition-all text-xs ${numAI === n ? 'bg-blue-900 border-blue-900 text-white scale-110 shadow-lg shadow-blue-900/40' : (numHumans === 2 && n === 0) ? 'border-gray-900 text-gray-800 opacity-20 cursor-not-allowed' : 'border-gray-800 text-gray-600 hover:border-gray-600'}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="w-full space-y-3 bg-black/30 p-4 rounded-xl border border-gray-800 max-h-48 overflow-y-auto custom-scrollbar">
                     <p className="text-xs uppercase tracking-widest text-gray-600 font-bold mb-2">Participant List</p>
                     {humanNames.map((name, i) => (
                       <div key={i} className="flex items-center gap-2">
                          <span className="text-xs text-blood font-mono w-4">{i+1}.</span>
                          <input 
                            type="text"
                            value={name}
                            onChange={(e) => {
                              const newNames = [...humanNames];
                              newNames[i] = e.target.value;
                              setHumanNames(newNames);
                            }}
                            placeholder={`Resident ${i+1} Name`}
                            className="flex-1 bg-transparent border-b border-gray-700 p-1 focus:border-blood outline-none text-sm transition-colors"
                          />
                       </div>
                     ))}
                     {numAI > 0 && (
                       <div className="pt-2 border-t border-gray-800/50 mt-2">
                         <p className="text-[10px] text-gray-500 uppercase tracking-tighter mb-1">Plus {numAI} AI Personas</p>
                         <p className="text-[10px] text-gray-600 italic">"The unknown residents speak in the shadows..."</p>
                       </div>
                     )}
                     {numHumans + numAI < 4 && (
                       <p className="text-[10px] text-amber-500 mt-2 flex items-center gap-1">
                         <AlertCircle className="w-2 h-2" />
                         Small games move fast... trust no one.
                       </p>
                     )}
                  </div>
                </div>

                <button 
                  onClick={handleSetup}
                  className="w-full py-4 bg-blood hover:bg-red-700 text-white font-bold rounded-lg shadow-xl shadow-blood/10 transition-all uppercase tracking-widest text-lg mt-4"
                >
                  Enter the Town
                </button>
              </div>
            )}

            {phase === 'RoleReveal' && (
              <div className="text-center">
                <AlertCircle className="w-12 h-12 text-blood mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2 underline decoration-blood">
                  {currentHuman?.name}, You are the <span className="text-blood">{currentHuman?.role}</span>
                </h3>
                <p className="text-gray-400 mb-6 italic">
                  {currentHuman?.role === 'Mafia' ? "Your goal is to eliminate the villagers. Keep your identity secret." : 
                   currentHuman?.role === 'Doctor' ? "You can save one person each night. Protect the innocent." :
                   "Work with the town to find the Mafia before it's too late."}
                </p>
                <button 
                  onClick={() => {
                    if (activeHumanIndex < numHumans - 1) {
                        setActiveHumanIndex(prev => prev + 1);
                        setIsPrivateVisible(true);
                    } else {
                        startNight();
                    }
                  }}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-lg transition-all"
                >
                  {activeHumanIndex < numHumans - 1 ? "Next Player" : "Wait for Nightfall"}
                </button>
              </div>
            )}

            {phase === 'Night' && (
              <div>
                <h3 className="text-center text-gray-400 uppercase tracking-widest text-sm mb-4">
                    {nightPhase === 'Mafia' ? 'Mafia, cast your silent vote for tonight\'s victim' : 'Doctor, choose a soul to safeguard'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                    {nightPhase === 'Mafia' && (
                        players.filter(p => p.isAlive && p.role !== 'Mafia').map(player => (
                          <button 
                            key={player.id}
                            onClick={() => handleMafiaTarget(player.id)}
                            className="py-2 px-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-blood hover:bg-blood/10 transition-all flex items-center justify-center gap-2"
                          >
                            <Skull className="w-4 h-4 opacity-50" />
                            {player.name}
                          </button>
                        ))
                    )}
                    {nightPhase === 'Doctor' && (
                        players.filter(p => p.isAlive).map(player => (
                          <button 
                            key={player.id}
                            onClick={() => handleDoctorSave(player.id)}
                            className="py-2 px-4 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-blue-900 hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2"
                          >
                            <Shield className="w-4 h-4 opacity-50" />
                            {player.name}
                          </button>
                        ))
                    )}
                </div>
              </div>
            )}

            {phase === 'Day' && (
              <div className="text-center">
                <h3 className="text-sm uppercase tracking-widest text-gray-500 mb-4">Sunlight offers no safety</h3>
                <button 
                  disabled={isNarrating}
                  onClick={startDiscussion}
                  className="w-full py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isNarrating ? "Players are speaking..." : "Begin Discussion"}
                </button>
              </div>
            )}

            {phase === 'Vote' && (
              <div>
                <h3 className="text-center text-sm uppercase tracking-widest text-gray-500 mb-4">The Noose Tightens - Cast Your Vote</h3>
                <div className="grid grid-cols-2 gap-3">
                  {players.filter(p => p.isAlive).map(player => (
                    <button 
                      key={player.id}
                      onClick={() => handleVote(player.id)}
                      className="py-2 px-4 rounded-lg border border-gray-700 hover:border-blood group flex items-center justify-center gap-2"
                    >
                      <User className="w-4 h-4 group-hover:text-blood" />
                      {player.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {phase === 'GameOver' && (
              <div className="text-center">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-4 bg-blood hover:bg-red-700 text-white rounded-lg font-bold uppercase tracking-widest"
                >
                  Return to Chaos
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1f2937;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #880808;
        }
      `}</style>
    </div>
  );
}
