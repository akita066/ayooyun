import React, { useState, useRef, useEffect } from 'react';
import { RADIO_STATIONS } from '../constants';
import { Play, Pause, Volume2, VolumeX, Radio as RadioIcon, ChevronUp, ChevronDown } from 'lucide-react';

interface RadioProps {
  isPlayingGame: boolean;
}

const Radio: React.FC<RadioProps> = ({ isPlayingGame }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStationIndex, setCurrentStationIndex] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Auto-minimize when game starts
    if (isPlayingGame) {
      setIsMinimized(true);
    }
  }, [isPlayingGame]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      setIsPlaying(true);
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Ignore AbortError which happens if pause() is called immediately
          if (error.name !== 'AbortError') {
             console.error("Audio playback failed:", error);
             setIsPlaying(false);
          }
        });
      }
    }
  };

  const changeStation = (index: number) => {
    setCurrentStationIndex(index);
    // Optimistically show playing state
    setIsPlaying(true);

    if (audioRef.current) {
      audioRef.current.src = RADIO_STATIONS[index].url;
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          // Ignore AbortError (caused by rapid switching)
          if (error.name !== 'AbortError') {
             console.error("Station switch error:", error);
             setIsPlaying(false);
          }
        });
      }
    }
  };

  const handleAudioError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
      console.warn("Radio stream failed to load.", e.currentTarget.error);
      setIsPlaying(false);
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 transition-all duration-300 ${isMinimized ? 'w-12 h-12 overflow-hidden' : 'w-72'}`}>
      <div className="bg-slate-800/90 backdrop-blur-md border border-slate-600 rounded-lg shadow-xl text-white overflow-hidden">
        {/* Header / Minimized View */}
        <div className="flex items-center justify-between p-3 bg-slate-900/50 cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
          <div className="flex items-center gap-2">
            <RadioIcon className={`w-5 h-5 ${isPlaying ? 'text-green-400 animate-pulse' : 'text-slate-400'}`} />
            {!isMinimized && <span className="font-bold text-sm">Turkish FM</span>}
          </div>
          <button className="text-slate-400 hover:text-white">
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>

        {/* Expanded Controls */}
        {!isMinimized && (
          <div className="p-4 space-y-4">
            {/* Station Info */}
            <div className="text-center">
              <div className="text-xs text-slate-400 uppercase tracking-wider mb-1">Now Playing</div>
              <div className="font-medium text-lg text-cyan-300 truncate">{RADIO_STATIONS[currentStationIndex].name}</div>
            </div>

            {/* Playback Controls */}
            <div className="flex justify-center items-center gap-4">
              <button 
                onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                className="w-10 h-10 bg-indigo-600 hover:bg-indigo-500 rounded-full flex items-center justify-center transition-colors"
              >
                {isPlaying ? <Pause size={20} fill="white" /> : <Play size={20} fill="white" className="ml-1" />}
              </button>
            </div>

            {/* Volume */}
            <div className="flex items-center gap-2">
              <button onClick={() => setIsMuted(!isMuted)} className="text-slate-400 hover:text-white">
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={volume} 
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-indigo-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>

            {/* Station List */}
            <div className="mt-2 h-32 overflow-y-auto border-t border-slate-700 pt-2">
              {RADIO_STATIONS.map((station, idx) => (
                <div 
                  key={idx}
                  onClick={() => changeStation(idx)}
                  className={`p-2 rounded cursor-pointer text-sm transition-colors flex justify-between items-center ${currentStationIndex === idx ? 'bg-indigo-900/50 text-indigo-300' : 'hover:bg-slate-700 text-slate-300'}`}
                >
                  <span>{station.name}</span>
                  {currentStationIndex === idx && isPlaying && (
                    <div className="flex gap-0.5 h-3 items-end">
                      <div className="w-0.5 bg-indigo-400 h-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                      <div className="w-0.5 bg-indigo-400 h-2/3 animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-0.5 bg-indigo-400 h-1/2 animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <audio 
        ref={audioRef} 
        src={RADIO_STATIONS[0].url} 
        loop={false} 
        crossOrigin="anonymous" 
        onError={handleAudioError}
      />
    </div>
  );
};

export default Radio;