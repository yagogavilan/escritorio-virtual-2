import React, { useState, useEffect, useRef } from 'react';
import { Video, VideoOff, Mic, MicOff, Settings, X, Check, AlertCircle } from 'lucide-react';

interface MediaPreviewModalProps {
  onJoin: () => void;
  onCancel: () => void;
  roomName: string;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  onJoin,
  onCancel,
  roomName
}) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [devices, setDevices] = useState<{
    audioInputs: MediaDeviceInfo[];
    videoInputs: MediaDeviceInfo[];
  }>({ audioInputs: [], videoInputs: [] });
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>('');
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);

  // Listar dispositivos disponíveis
  useEffect(() => {
    const getDevices = async () => {
      try {
        const deviceList = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = deviceList.filter(d => d.kind === 'audioinput');
        const videoInputs = deviceList.filter(d => d.kind === 'videoinput');

        setDevices({ audioInputs, videoInputs });

        if (audioInputs.length > 0 && !selectedAudioInput) {
          setSelectedAudioInput(audioInputs[0].deviceId);
        }
        if (videoInputs.length > 0 && !selectedVideoInput) {
          setSelectedVideoInput(videoInputs[0].deviceId);
        }
      } catch (err) {
        console.error('Error enumerating devices:', err);
      }
    };

    getDevices();
  }, []);

  // Iniciar stream de mídia
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startMedia = async () => {
      setIsLoading(true);
      try {
        const constraints: MediaStreamConstraints = {
          audio: selectedAudioInput ? { deviceId: { exact: selectedAudioInput } } : true,
          video: selectedVideoInput ? { deviceId: { exact: selectedVideoInput } } : true,
        };

        stream = await navigator.mediaDevices.getUserMedia(constraints);
        setMediaStream(stream);
        setError(null);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        setIsLoading(false);
      } catch (err: any) {
        console.error('Error accessing media devices:', err);
        let errorMessage = 'Não foi possível acessar câmera/microfone.';

        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          errorMessage = 'Permissão negada. Por favor, permita o acesso à câmera e microfone.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'Nenhuma câmera ou microfone encontrado.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'Dispositivo já está em uso por outro aplicativo.';
        }

        setError(errorMessage);
        setIsLoading(false);
      }
    };

    if (selectedAudioInput || selectedVideoInput) {
      startMedia();
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
      }
    };
  }, [selectedAudioInput, selectedVideoInput]);

  // Controlar mute
  useEffect(() => {
    if (mediaStream) {
      mediaStream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });
    }
  }, [isMuted, mediaStream]);

  // Controlar câmera
  useEffect(() => {
    if (mediaStream) {
      mediaStream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });
    }
  }, [isCameraOff, mediaStream]);

  const handleJoin = () => {
    // Não parar o stream aqui - será usado na chamada
    onJoin();
  };

  const handleCancel = () => {
    // Parar o stream ao cancelar
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
    }
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
      <div className="bg-slate-900 rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Preparar para entrar</h2>
            <p className="text-slate-400 text-sm mt-1">{roomName}</p>
          </div>
          <button
            onClick={handleCancel}
            className="p-2 hover:bg-slate-700 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Video Preview */}
          <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video mb-6 border border-slate-700">
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
                  <p className="text-slate-400 text-sm">Iniciando câmera...</p>
                </div>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="flex flex-col items-center gap-3 p-6 text-center">
                  <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center">
                    <AlertCircle size={32} className="text-red-400" />
                  </div>
                  <div>
                    <p className="text-white font-semibold mb-1">Erro ao acessar mídia</p>
                    <p className="text-slate-400 text-sm max-w-md">{error}</p>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Você ainda pode entrar, mas sem câmera/microfone
                  </p>
                </div>
              </div>
            )}

            {!isLoading && !error && (isCameraOff || !mediaStream) && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
                <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl text-slate-400 font-bold border-4 border-slate-600">
                  <VideoOff size={48} className="text-slate-500" />
                </div>
              </div>
            )}

            {!isLoading && !error && !isCameraOff && mediaStream && (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform scale-x-[-1]"
              />
            )}

            {/* Controles sobre o vídeo */}
            <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-3 rounded-xl transition-all ${
                    isMuted
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-slate-700/80 backdrop-blur text-white hover:bg-slate-600/80'
                  }`}
                  title={isMuted ? 'Desmutar' : 'Mutar'}
                >
                  {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                </button>

                <button
                  onClick={() => setIsCameraOff(!isCameraOff)}
                  className={`p-3 rounded-xl transition-all ${
                    isCameraOff
                      ? 'bg-red-500 text-white hover:bg-red-600'
                      : 'bg-slate-700/80 backdrop-blur text-white hover:bg-slate-600/80'
                  }`}
                  title={isCameraOff ? 'Ligar Câmera' : 'Desligar Câmera'}
                >
                  {isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                </button>
              </div>

              <button
                onClick={() => setShowDeviceSettings(!showDeviceSettings)}
                className="p-3 rounded-xl bg-slate-700/80 backdrop-blur text-white hover:bg-slate-600/80 transition-all"
                title="Configurações de dispositivo"
              >
                <Settings size={20} />
              </button>
            </div>
          </div>

          {/* Device Settings */}
          {showDeviceSettings && (
            <div className="mb-6 p-4 bg-slate-800 rounded-xl border border-slate-700 space-y-4 animate-in slide-in-from-top-2 fade-in duration-200">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Settings size={16} />
                Configurações de Dispositivo
              </h3>

              {/* Microfone */}
              <div>
                <label className="text-slate-400 text-xs font-medium mb-2 block">
                  Microfone
                </label>
                <select
                  value={selectedAudioInput}
                  onChange={(e) => setSelectedAudioInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {devices.audioInputs.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Microfone ${devices.audioInputs.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>

              {/* Câmera */}
              <div>
                <label className="text-slate-400 text-xs font-medium mb-2 block">
                  Câmera
                </label>
                <select
                  value={selectedVideoInput}
                  onChange={(e) => setSelectedVideoInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {devices.videoInputs.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Câmera ${devices.videoInputs.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="flex-1 py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-semibold transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleJoin}
              className="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/30"
            >
              <Check size={20} />
              Entrar na Sala
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
