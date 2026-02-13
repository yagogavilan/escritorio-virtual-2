import React from 'react';
import { Maximize2, X, Mic, MicOff, Video, VideoOff, Users, Monitor, Phone } from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';

interface MinimizedCallProps {
  title: string;
  type: 'room' | 'call';
  participantCount?: number;
  onExpand: () => void;
  onEnd: () => void;
}

export const MinimizedCall: React.FC<MinimizedCallProps> = ({
  title,
  type,
  participantCount = 1,
  onExpand,
  onEnd
}) => {
  const {
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    isInitialized
  } = useMedia();

  return (
    <div className="fixed bottom-0 left-20 md:left-56 right-0 z-[90] bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-t-2 border-indigo-500/50 shadow-2xl animate-in slide-in-from-bottom-5 fade-in backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between gap-6">
          {/* Left Side - Call Info */}
          <div className="flex items-center gap-4 min-w-0">
            {/* Icon & Status */}
            <div className="relative shrink-0">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                {type === 'room' ? (
                  <Monitor size={24} className="text-white" />
                ) : (
                  <Phone size={24} className="text-white" />
                )}
              </div>
              {/* Pulse Animation */}
              <div className="absolute inset-0 rounded-xl bg-indigo-500 animate-ping opacity-20"></div>
            </div>

            {/* Call Details */}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-white font-bold text-base truncate">{title}</h3>
                {type === 'room' && participantCount > 1 && (
                  <div className="bg-indigo-500/20 backdrop-blur-sm px-2 py-0.5 rounded-full flex items-center gap-1 border border-indigo-400/30">
                    <Users size={12} className="text-indigo-300" />
                    <span className="text-indigo-200 text-xs font-bold">{participantCount}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                <p className="text-slate-400 text-xs font-medium">
                  {type === 'room' ? 'Sala' : 'Chamada'} em andamento
                </p>
                {isMuted && (
                  <div className="bg-red-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-400/30">
                    <MicOff size={10} className="text-red-300" />
                    <span className="text-red-200 text-xs font-semibold">Mudo</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Center - Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              disabled={!isInitialized}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg ${
                isMuted
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 ring-2 ring-red-400/30'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
              title={isMuted ? 'Desmutar' : 'Mutar'}
            >
              {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              <span className="hidden md:inline">{isMuted ? 'Mutado' : 'Microfone'}</span>
            </button>

            <button
              onClick={toggleCamera}
              disabled={!isInitialized}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all flex items-center gap-2 shadow-lg ${
                isCameraOff
                  ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/30 ring-2 ring-red-400/30'
                  : 'bg-slate-700 hover:bg-slate-600 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95`}
              title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
            >
              {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
              <span className="hidden md:inline">{isCameraOff ? 'Câmera Off' : 'Câmera'}</span>
            </button>
          </div>

          {/* Right Side - Main Actions */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onExpand}
              className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-2xl shadow-indigo-500/50 hover:scale-105 active:scale-95 ring-2 ring-indigo-400/30"
              title="Expandir Chamada"
            >
              <Maximize2 size={20} className="animate-pulse" />
              <span>Expandir</span>
            </button>

            <button
              onClick={onEnd}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95"
              title="Encerrar Chamada"
            >
              <X size={20} />
              <span className="hidden lg:inline">Sair</span>
            </button>
          </div>
        </div>
      </div>

      {/* Decorative Gradient Bar */}
      <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 opacity-50"></div>
    </div>
  );
};
