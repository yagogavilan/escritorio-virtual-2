import React, { useRef, useEffect, useState } from 'react';
import { Maximize2, X, Mic, MicOff, Video, VideoOff, Users, Monitor } from 'lucide-react';
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
    localStream,
    isMuted,
    isCameraOff,
    toggleMute,
    toggleCamera,
    isInitialized
  } = useMedia();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && localStream && !isCameraOff) {
      videoRef.current.srcObject = localStream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [localStream, isCameraOff]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 320));
        const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 200));
        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div
      className={`fixed z-[90] bg-slate-900 rounded-2xl shadow-2xl border-2 border-slate-700 overflow-hidden transition-all duration-300 ${
        isDragging ? 'cursor-grabbing scale-105 shadow-indigo-500/50' : 'cursor-grab'
      } animate-in slide-in-from-bottom-10 fade-in`}
      style={{
        left: `${position.x}px`,
        bottom: `${position.y}px`,
        width: '320px',
      }}
      onMouseDown={handleMouseDown}
    >
      {/* Video Preview */}
      <div className="relative bg-slate-800 h-40 overflow-hidden">
        {!isCameraOff && localStream && isInitialized ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform scale-x-[-1]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
            <VideoOff size={40} className="text-slate-600" />
          </div>
        )}

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-transparent to-transparent pointer-events-none"></div>

        {/* Status Indicators */}
        <div className="absolute top-3 left-3 flex gap-2">
          {isMuted && (
            <div className="bg-red-500/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <MicOff size={12} className="text-white" />
            </div>
          )}
          {type === 'room' && participantCount > 1 && (
            <div className="bg-indigo-500/90 backdrop-blur-sm px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
              <Users size={12} className="text-white" />
              <span className="text-white text-xs font-bold">{participantCount}</span>
            </div>
          )}
        </div>

        {/* Top Actions */}
        <div className="absolute top-3 right-3 flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand();
            }}
            className="p-2 bg-slate-700/80 hover:bg-slate-600 backdrop-blur-sm rounded-full transition-all hover:scale-110 shadow-lg"
            title="Expandir"
          >
            <Maximize2 size={14} className="text-white" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEnd();
            }}
            className="p-2 bg-red-500/80 hover:bg-red-600 backdrop-blur-sm rounded-full transition-all hover:scale-110 shadow-lg"
            title="Encerrar"
          >
            <X size={14} className="text-white" />
          </button>
        </div>
      </div>

      {/* Info Bar */}
      <div className="bg-slate-900 px-4 py-3 border-t border-slate-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {type === 'room' ? (
              <Monitor size={16} className="text-indigo-400 shrink-0" />
            ) : (
              <Video size={16} className="text-emerald-400 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold text-sm truncate">{title}</p>
              <p className="text-slate-400 text-xs">
                {type === 'room' ? 'Sala' : 'Chamada'} em andamento
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleMute();
            }}
            disabled={!isInitialized}
            className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            } disabled:opacity-50`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
            {isMuted ? 'Mutado' : 'Mic'}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleCamera();
            }}
            disabled={!isInitialized}
            className={`flex-1 py-2 rounded-lg font-semibold text-xs transition-all flex items-center justify-center gap-1.5 ${
              isCameraOff
                ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/30'
                : 'bg-slate-700 hover:bg-slate-600 text-white'
            } disabled:opacity-50`}
            title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
          >
            {isCameraOff ? <VideoOff size={14} /> : <Video size={14} />}
            {isCameraOff ? 'Câmera Off' : 'Câmera'}
          </button>
        </div>
      </div>

      {/* Drag Handle Indicator */}
      <div className="absolute top-2 left-1/2 transform -translate-x-1/2 w-12 h-1 bg-slate-600 rounded-full opacity-50"></div>
    </div>
  );
};
