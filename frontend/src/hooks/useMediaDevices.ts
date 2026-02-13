import { useState, useEffect } from 'react';
import { MediaDevices } from '../types';

export const useMediaDevices = () => {
  const [devices, setDevices] = useState<MediaDevices>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enumerateDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Request permissions first to get labeled devices
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true });

      const deviceList = await navigator.mediaDevices.enumerateDevices();

      setDevices({
        audioInputs: deviceList.filter(d => d.kind === 'audioinput'),
        videoInputs: deviceList.filter(d => d.kind === 'videoinput'),
        audioOutputs: deviceList.filter(d => d.kind === 'audiooutput')
      });

      setIsLoading(false);
    } catch (err: any) {
      console.error('Error enumerating devices:', err);

      let errorMessage = 'Erro ao listar dispositivos';
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Permissão negada para acessar dispositivos';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'Nenhum dispositivo encontrado';
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    enumerateDevices();

    // Listen for device changes
    const handleDeviceChange = () => {
      console.log('[useMediaDevices] Device change detected');
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, []);

  return { devices, isLoading, error, refetch: enumerateDevices };
};
