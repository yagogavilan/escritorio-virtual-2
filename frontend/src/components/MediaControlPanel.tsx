import React, { useRef, useEffect, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  SlidersHorizontal,
  AlertCircle,
  RefreshCw,
  Maximize2,
  X
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
  const [isExpanded, setIsExpanded] = useState(false);

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

  return (
    <>
      {/* Compact Layout - Larger square preview on left, vertical controls on right */}
      <div className="flex items-center gap-2.5 p-3 border-t border-slate-100 bg-slate-50/50">
        {/* Larger Square Video Preview - Left Side */}
        <div
          className="relative bg-slate-800 rounded-xl overflow-hidden group cursor-pointer flex-shrink-0 w-20 h-20 shadow-md"
          onClick={() => setIsExpanded(true)}
        >
          {isInitializing && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <AlertCircle size={18} className="text-red-400" />
            </div>
          )}

          {!isInitializing && !error && (isCameraOff || !localStream) && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <VideoOff size={24} className="text-slate-500" />
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

          {/* Expand Icon on Hover */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
            <Maximize2 size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>

          {/* Muted Indicator */}
          {isMuted && isInitialized && (
            <div className="absolute top-1 right-1 bg-red-500/90 p-0.5 rounded">
              <MicOff size={10} className="text-white" />
            </div>
          )}

          {/* Status Dot */}
          {isInitialized && (
            <div className={`absolute bottom-1 left-1 w-2 h-2 rounded-full ${STATUS_CONFIG[currentUserStatus].color} ring-1 ring-white`}></div>
          )}
        </div>

        {/* Vertical Controls - Right Side */}
        <div className="flex flex-col gap-1">
          <button
            onClick={toggleMute}
            disabled={!isInitialized}
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              isMuted
                ? 'bg-red-500 text-white'
                : 'bg-slate-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90`}
            title={isMuted ? 'Desmutar' : 'Mutar'}
          >
            {isMuted ? <MicOff size={13} /> : <Mic size={13} />}
          </button>

          <button
            onClick={toggleCamera}
            disabled={!isInitialized}
            className={`p-1.5 rounded-md transition-all flex items-center justify-center ${
              isCameraOff
                ? 'bg-red-500 text-white'
                : 'bg-slate-700 text-white'
            } disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90`}
            title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
          >
            {isCameraOff ? <VideoOff size={13} /> : <Video size={13} />}
          </button>

          <button
            onClick={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded-md bg-slate-600 text-white hover:bg-slate-500 transition-colors flex items-center justify-center"
            title="Dispositivos"
          >
            <SlidersHorizontal size={13} />
          </button>
        </div>
      </div>

      {/* Device Settings - Collapsible */}
      {showSettings && (
        <div className="px-3 pb-2 bg-slate-50/50 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="p-2 bg-white rounded-lg border border-slate-200 space-y-2">
            {/* Microfone */}
            <div>
              <label className="text-slate-500 text-[9px] font-medium mb-1 block flex items-center gap-0.5">
                <Mic size={9} />
                Microfone
              </label>
              <select
                value={selectedAudioInput}
                onChange={(e) => setAudioInput(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
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
              <label className="text-slate-500 text-[9px] font-medium mb-1 block flex items-center gap-0.5">
                <Video size={9} />
                Câmera
              </label>
              <select
                value={selectedVideoInput}
                onChange={(e) => setVideoInput(e.target.value)}
                className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-700 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-400"
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

      {/* Expanded Modal */}
      {isExpanded && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setIsExpanded(false)}>
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-700" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-slate-800 px-4 py-3 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${STATUS_CONFIG[currentUserStatus].color} ring-2 ${STATUS_CONFIG[currentUserStatus].ring}`}></div>
                <h3 className="text-white font-bold text-sm">Preview de Câmera</h3>
              </div>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1.5 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Large Video Preview */}
            <div className="p-6">
              <div className="relative bg-slate-800 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl" style={{ aspectRatio: '16/9' }}>
                {isInitializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                      <p className="text-slate-400 text-sm">Iniciando...</p>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800 p-6">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                        <AlertCircle size={32} className="text-red-400" />
                      </div>
                      <div>
                        <p className="text-white font-semibold mb-1">Erro ao acessar mídia</p>
                        <p className="text-slate-400 text-sm">{error}</p>
                      </div>
                      <button
                        onClick={initializeMedia}
                        className="mt-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg flex items-center gap-2 transition-colors"
                      >
                        <RefreshCw size={14} />
                        Tentar Novamente
                      </button>
                    </div>
                  </div>
                )}

                {!isInitializing && !error && (isCameraOff || !localStream) && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                    <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center border-4 border-slate-600">
                      <VideoOff size={48} className="text-slate-500" />
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
                  <div className="absolute top-4 right-4 bg-red-500/90 p-2.5 rounded-full animate-pulse shadow-lg">
                    <MicOff size={18} className="text-white" />
                  </div>
                )}
              </div>

              {/* Controls in Modal */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={toggleMute}
                  disabled={!isInitialized}
                  className={`flex-1 p-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                    isMuted
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isMuted ? <MicOff size={18} /> : <Mic size={18} />}
                  {isMuted ? 'Desmutar' : 'Mutar'}
                </button>

                <button
                  onClick={toggleCamera}
                  disabled={!isInitialized}
                  className={`flex-1 p-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 ${
                    isCameraOff
                      ? 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/30'
                      : 'bg-slate-700 text-white hover:bg-slate-600'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {isCameraOff ? <VideoOff size={18} /> : <Video size={18} />}
                  {isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
