import React, { useState, useRef, useCallback, useEffect } from 'react';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import GameCanvas, { GameEngineHandle } from './components/GameCanvas';
import HUD from './components/HUD';
import Radio from './components/Radio';
import AdminPanel from './components/AdminPanel';
import { GameState, GameSettings, Player, DebugState, LeaderboardEntry } from './types';
import { socketService } from './socket';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.LOBBY);
  const [settings, setSettings] = useState<GameSettings>({
    playerName: 'Guest',
    playerColor: '#ef4444',
    soundEnabled: true,
    roomId: '',
    isHost: false,
    isOnline: false,
    initialPotatoSpeed: 1.0,
    maxPlayers: 12,
    isPrivate: false
  });

  // Debug State
  const [debugState, setDebugState] = useState<DebugState>({
    isEnabled: false,
    showHitboxes: false,
    showPathfinding: false,
    godMode: false,
    infiniteAbilities: false,
    timeScale: 1.0,
    potatoSpeedModifier: 0
  });

  // Game Stats State
  const [playerStats, setPlayerStats] = useState<Player | undefined>(undefined);
  const [gameStats, setGameStats] = useState({
    playersAlive: 0,
    totalPlayers: 0,
    gameTime: 0,
    fps: 0,
    ping: 0
  });
  
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  // Spectator State
  const [spectatingTargetName, setSpectatingTargetName] = useState<string | null>(null);

  const gameEngineRef = useRef<GameEngineHandle>(null);
  const frameCounter = useRef(0);
  
  // Admin Key Trigger Logic (adminmemo)
  const keySequence = useRef<string>('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
       const key = e.key.toLowerCase();
       if (key.length === 1) { // Only printable chars
           keySequence.current = (keySequence.current + key).slice(-9); // Keep last 9 chars
           
           if (keySequence.current === 'adminmemo') {
               setDebugState(prev => ({ ...prev, isEnabled: !prev.isEnabled }));
               keySequence.current = ''; // Reset
           }
       }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Ping Measurement Loop
  useEffect(() => {
    if (!settings.isOnline) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('pong_check', (sentTime) => {
        const latency = Date.now() - sentTime;
        // Send calculated latency back to server so everyone can see it
        socket.emit('update_ping', latency);
        setGameStats(prev => ({ ...prev, ping: latency }));
    });

    const interval = setInterval(() => {
        socket.emit('ping_check', Date.now());
    }, 2000); // Check every 2 seconds

    return () => {
        clearInterval(interval);
        socket.off('pong_check');
    };
  }, [settings.isOnline]);

  const handleJoinGame = (newSettings: GameSettings) => {
    setSettings(newSettings);
    // If online, go to waiting room first. If offline (Single player), play immediately.
    if (newSettings.isOnline) {
        setGameState(GameState.WAITING);
    } else {
        setGameState(GameState.PLAYING);
    }
  };

  const handleStartGameOnline = () => {
      setGameState(GameState.PLAYING);
  };

  const handleLeaveRoom = () => {
      socketService.disconnect();
      setGameState(GameState.LOBBY);
  };

  const handleUpdateStats = useCallback((
    player: Player | undefined, 
    alive: number, 
    total: number, 
    time: number, 
    fps: number, 
    spectatingName: string | null,
    allPlayers: Player[]
  ) => {
    frameCounter.current++;
    if (frameCounter.current % 6 !== 0) return;

    setPlayerStats(player ? { ...player } : undefined);
    setGameStats(prev => ({
      ...prev,
      playersAlive: alive,
      totalPlayers: total,
      gameTime: time,
      fps: fps,
    }));
    setSpectatingTargetName(spectatingName);

    // Update Leaderboard
    const sorted = [...allPlayers].sort((a, b) => b.score - a.score).slice(0, 5).map(p => ({
        id: p.id,
        name: p.name,
        score: p.score,
        isDead: p.isDead,
        isBot: p.isBot
    }));
    setLeaderboard(sorted);

  }, []);

  // Spectator Actions
  const handleSpectateNext = () => { gameEngineRef.current?.spectateNext(); };
  const handleSpectatePrev = () => { gameEngineRef.current?.spectatePrev(); };
  const handleSpectatePotato = () => { gameEngineRef.current?.spectatePotato(); };
  const handleEnterSpectatorMode = () => { gameEngineRef.current?.enterSpectatorMode(); };
  const handleReturnToLobby = () => { 
      if(settings.isOnline) {
          handleLeaveRoom();
      } else {
          setGameState(GameState.LOBBY); 
      }
  };
  const handleRestart = () => {
    gameEngineRef.current?.resetGame();
    setGameState(GameState.PLAYING);
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-900">
      
      {/* Game Canvas always mounted but potentially hidden/paused or active */}
      <GameCanvas 
        ref={gameEngineRef}
        settings={settings}
        gameState={gameState}
        setGameState={setGameState}
        onUpdateStats={handleUpdateStats}
        debugState={debugState}
      />

      {gameState === GameState.LOBBY && (
        <Lobby onJoin={handleJoinGame} />
      )}

      {gameState === GameState.WAITING && (
          <WaitingRoom 
            settings={settings} 
            onStartGame={handleStartGameOnline}
            onLeave={handleLeaveRoom}
          />
      )}

      {(gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) && (
        <HUD 
          player={playerStats}
          gameState={gameState}
          playersAlive={gameStats.playersAlive}
          totalPlayers={gameStats.totalPlayers}
          gameTime={gameStats.gameTime}
          fps={gameStats.fps}
          ping={gameStats.ping}
          spectatingTargetName={spectatingTargetName}
          onSpectateNext={handleSpectateNext}
          onSpectatePrev={handleSpectatePrev}
          onSpectatePotato={handleSpectatePotato}
          onEnterSpectatorMode={handleEnterSpectatorMode}
          onReturnToLobby={handleReturnToLobby}
          onRestart={handleRestart}
          leaderboard={leaderboard}
        />
      )}

      <Radio isPlayingGame={gameState === GameState.PLAYING} />
      
      {/* Admin Panel Overlay */}
      <AdminPanel 
        debugState={debugState} 
        onUpdate={setDebugState} 
        onClose={() => setDebugState(prev => ({...prev, isEnabled: false}))} 
      />
    </div>
  );
};

export default App;