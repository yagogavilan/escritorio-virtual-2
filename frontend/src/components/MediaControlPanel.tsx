import React, { useRef, useEffect, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Settings,
  ChevronDown,
  AlertCircle,
  RefreshCw,
  Monitor,
  Volume2
} from 'lucide-react';
import { useMedia } from '../contexts/MediaContext';
import { UserStatus } from '../types';

interface MediaControlPanelProps {
  currentUserStatus: UserStatus;
  onStatusChange: (status: UserStatus) => void;
}

const STATUS_CONFIG = {
  'online': { color: 'bg-emerald-500', label: 'Online', ring: 'ring-emerald-200', textColor: 'text-emerald-600' },
  'busy': { color: 'bg-rose-500', label: 'Ocupado', ring: 'ring-rose-200', textColor: 'text-rose-600' },
  'away': { color: 'bg-amber-500', label: 'Ausente', ring: 'ring-amber-200', textColor: 'text-amber-600' },
  'offline': { color: 'bg-slate-400', label: 'Offline', ring: 'ring-slate-200', textColor: 'text-slate-600' },
  'in-meeting': { color: 'bg-violet-500', label: 'Em Reunião', ring: 'ring-violet-200', textColor: 'text-violet-600' },
};

export const MediaControlPanel: React.FC<MediaControlPanelProps> = ({
  currentUserStatus,
  onStatusChange
}) => {
  const {
    localStream,
    isMuted,
    isCameraOff,
    devices,
    selectedAudioInput,
    selectedVideoInput,
    isInitialized,
    isInitializing,
    error,
    toggleMute,
    toggleCamera,
    setAudioInput,
    setVideoInput,
    initializeMedia
  } = useMedia();

  const videoRef = useRef<HTMLVideoElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && localStream && !isCameraOff) {
      videoRef.current.srcObject = localStream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [localStream, isCameraOff]);

  // Initialize media on mount
  useEffect(() => {
    if (!isInitialized && !isInitializing) {
      initializeMedia();
    }
  }, []);

  const statusOptions: UserStatus[] = ['online', 'busy', 'away', 'in-meeting'];

  return (
    <div className="w-72 bg-slate-900 border-r border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-700">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <Monitor size={16} className="text-indigo-400" />
          Controles de Mídia
        </h3>
      </div>

      {/* Video Preview */}
      <div className="p-4">
        <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video border-2 border-slate-700 shadow-xl">
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                <p className="text-slate-400 text-xs">Iniciando...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800 p-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <p className="text-white text-xs font-semibold">Erro de Mídia</p>
                <p className="text-slate-400 text-[10px]">{error}</p>
                <button
                  onClick={initializeMedia}
                  className="mt-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded-lg flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={12} />
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}

          {!isInitializing && !error && (isCameraOff || !localStream) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center border-4 border-slate-600">
                <VideoOff size={32} className="text-slate-500" />
              </div>
            </div>
          )}

          {!isInitializing && !error && !isCameraOff && localStream && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          )}

          {/* Muted Indicator */}
          {isMuted && isInitialized && (
            <div className="absolute top-3 right-3 bg-red-500/90 p-2 rounded-full animate-pulse shadow-lg backdrop-blur-sm">
              <MicOff size={14} className="text-white" />
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="px-4 pb-4">
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            disabled={!isInitialized}
            className={`flex-1 p-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
              isMuted
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <button
            onClick={toggleCamera}
            disabled={!isInitialized}
            className={`flex-1 p-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
              isCameraOff
                ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                : 'bg-slate-700 text-white hover:bg-slate-600'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
          >
            {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-3 rounded-xl bg-slate-700 text-white hover:bg-slate-600 transition-colors"
            title="Configurações"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* Device Settings */}
      {showSettings && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="bg-slate-800 rounded-xl p-3 space-y-3 border border-slate-700">
            <h4 className="text-white font-semibold text-xs flex items-center gap-2">
              <Settings size={14} />
              Configurações de Dispositivo
            </h4>

            {/* Microfone */}
            <div>
              <label className="text-slate-400 text-[10px] font-medium mb-1.5 block flex items-center gap-1">
                <Mic size={12} />
                Microfone
              </label>
              <select
                value={selectedAudioInput}
                onChange={(e) => setAudioInput(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {devices.audioInputs.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microfone ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Câmera */}
            <div>
              <label className="text-slate-400 text-[10px] font-medium mb-1.5 block flex items-center gap-1">
                <Video size={12} />
                Câmera
              </label>
              <select
                value={selectedVideoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {devices.videoInputs.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Câmera ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Status Selector */}
      <div className="px-4 pb-4 border-t border-slate-700 pt-4 mt-auto">
        <div className="relative">
          <button
            onClick={() => setShowStatusMenu(!showStatusMenu)}
            className="w-full p-3 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors flex items-center justify-between"
          >
            <div className="flex items-center gap-2.5">
              <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[currentUserStatus].color} ring-4 ${STATUS_CONFIG[currentUserStatus].ring} shadow-lg`}></div>
              <span className="text-white text-sm font-semibold">
                {STATUS_CONFIG[currentUserStatus].label}
              </span>
            </div>
            <ChevronDown size={16} className="text-slate-400" />
          </button>

          {showStatusMenu && (
            <div className="absolute bottom-full mb-2 left-0 right-0 bg-white rounded-xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-2 duration-200">
              {statusOptions.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    onStatusChange(status);
                    setShowStatusMenu(false);
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                    currentUserStatus === status ? 'bg-indigo-50' : ''
                  }`}
                >
                  <div className={`w-3 h-3 rounded-full ${STATUS_CONFIG[status].color} ring-2 ${STATUS_CONFIG[status].ring}`}></div>
                  <span className={`text-sm font-semibold ${
                    currentUserStatus === status ? 'text-indigo-600' : 'text-slate-700'
                  }`}>
                    {STATUS_CONFIG[status].label}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="px-4 pb-3">
        <div className="text-center text-[10px] text-slate-500">
          {isInitialized && (
            <p className="flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
              Mídia ativa
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
