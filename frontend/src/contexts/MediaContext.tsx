import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { MediaPreferences, MediaDevices, UserStatus } from '../types';
import { useMediaDevices } from '../hooks/useMediaDevices';

interface MediaContextValue {
  // Streams
  localStream: MediaStream | null;

  // Estados de controle
  isMuted: boolean;
  isCameraOff: boolean;

  // Dispositivos
  devices: MediaDevices;
  selectedAudioInput: string;
  selectedVideoInput: string;

  // Estado de inicialização
  isInitialized: boolean;
  isInitializing: boolean;
  error: string | null;

  // Ações
  toggleMute: () => void;
  toggleCamera: () => void;
  setAudioInput: (deviceId: string) => void;
  setVideoInput: (deviceId: string) => void;
  initializeMedia: () => Promise<void>;
  stopMedia: () => void;
  getStream: () => MediaStream | null;
}

const MediaContext = createContext<MediaContextValue | undefined>(undefined);

const STORAGE_KEY = 'mediaPreferences';

const getStoredPreferences = (): MediaPreferences => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (err) {
    console.error('Error loading media preferences:', err);
  }

  return {
    defaultMuted: false,
    defaultCameraOff: false
  };
};

const savePreferences = (preferences: MediaPreferences) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (err) {
    console.error('Error saving media preferences:', err);
  }
};

interface MediaProviderProps {
  children: ReactNode;
}

export const MediaProvider: React.FC<MediaProviderProps> = ({ children }) => {
  const { devices, isLoading: devicesLoading } = useMediaDevices();

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [selectedAudioInput, setSelectedAudioInput] = useState('');
  const [selectedVideoInput, setSelectedVideoInput] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);

  // Load preferences on mount
  useEffect(() => {
    const prefs = getStoredPreferences();
    setIsMuted(prefs.defaultMuted);
    setIsCameraOff(prefs.defaultCameraOff);

    // Set selected devices from preferences or defaults
    if (devices.audioInputs.length > 0) {
      setSelectedAudioInput(prefs.audioInputId || devices.audioInputs[0].deviceId);
    }
    if (devices.videoInputs.length > 0) {
      setSelectedVideoInput(prefs.videoInputId || devices.videoInputs[0].deviceId);
    }
  }, [devices]);

  // Save preferences when they change
  useEffect(() => {
    if (isInitialized) {
      savePreferences({
        audioInputId: selectedAudioInput,
        videoInputId: selectedVideoInput,
        defaultMuted: isMuted,
        defaultCameraOff: isCameraOff
      });
    }
  }, [selectedAudioInput, selectedVideoInput, isMuted, isCameraOff, isInitialized]);

  const initializeMedia = async () => {
    if (isInitializing || isInitialized) {
      console.log('[MediaContext] Already initialized or initializing');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      console.log('[MediaContext] Initializing media...');

      const constraints: MediaStreamConstraints = {
        audio: selectedAudioInput
          ? { deviceId: { exact: selectedAudioInput } }
          : true,
        video: selectedVideoInput
          ? { deviceId: { exact: selectedVideoInput } }
          : true
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      console.log('[MediaContext] Media stream obtained successfully');

      // Apply initial states
      stream.getAudioTracks().forEach(track => {
        track.enabled = !isMuted;
      });

      stream.getVideoTracks().forEach(track => {
        track.enabled = !isCameraOff;
      });

      streamRef.current = stream;
      setLocalStream(stream);
      setIsInitialized(true);
      setError(null);
    } catch (err: any) {
      console.error('[MediaContext] Error initializing media:', err);

      let errorMessage = 'Erro ao acessar câmera/microfone';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorMessage = 'Permissão negada. Por favor, permita o acesso à câmera e microfone.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhuma câmera ou microfone encontrado.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Dispositivo já está em uso por outro aplicativo.';
      }

      setError(errorMessage);
    } finally {
      setIsInitializing(false);
    }
  };

  const stopMedia = () => {
    console.log('[MediaContext] Stopping media stream');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    setLocalStream(null);
    setIsInitialized(false);
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);

    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !newMutedState;
      });
    }

    console.log('[MediaContext] Mute toggled:', newMutedState);
  };

  const toggleCamera = () => {
    const newCameraState = !isCameraOff;
    setIsCameraOff(newCameraState);

    if (streamRef.current) {
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !newCameraState;
      });
    }

    console.log('[MediaContext] Camera toggled:', newCameraState);
  };

  const setAudioInput = async (deviceId: string) => {
    console.log('[MediaContext] Changing audio input to:', deviceId);
    setSelectedAudioInput(deviceId);

    // If already initialized, restart stream with new device
    if (isInitialized) {
      stopMedia();
      setIsInitialized(false);
      // Will be re-initialized by useEffect or manually
      setTimeout(() => {
        initializeMedia();
      }, 100);
    }
  };

  const setVideoInput = async (deviceId: string) => {
    console.log('[MediaContext] Changing video input to:', deviceId);
    setSelectedVideoInput(deviceId);

    // If already initialized, restart stream with new device
    if (isInitialized) {
      stopMedia();
      setIsInitialized(false);
      // Will be re-initialized by useEffect or manually
      setTimeout(() => {
        initializeMedia();
      }, 100);
    }
  };

  const getStream = () => {
    return streamRef.current;
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMedia();
    };
  }, []);

  const value: MediaContextValue = {
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
    initializeMedia,
    stopMedia,
    getStream
  };

  return (
    <MediaContext.Provider value={value}>
      {children}
    </MediaContext.Provider>
  );
};

export const useMedia = () => {
  const context = useContext(MediaContext);
  if (!context) {
    throw new Error('useMedia must be used within a MediaProvider');
  }
  return context;
};
