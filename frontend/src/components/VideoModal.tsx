
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Users, MessageSquare, Wand2, UserPlus, Check, X, AlertCircle, Minimize2 } from 'lucide-react';
import { User } from '../types';
import { io, Socket } from 'socket.io-client';
import { useMedia } from '../contexts/MediaContext';

interface VideoModalProps {
  currentUser: User;
  participants: User[];
  roomName: string;
  allUsers: User[];
  onLeave: () => void;
  onInvite: (users: User[]) => void;
  onMinimize?: () => void;
}

interface PeerConnection {
  connection: RTCPeerConnection;
  stream: MediaStream | null;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export const VideoModal: React.FC<VideoModalProps> = ({
  currentUser,
  participants,
  roomName,
  allUsers,
  onLeave,
  onInvite,
  onMinimize
}) => {
  // Use Media Context for centralized media management
  const {
    localStream: contextStream,
    isMuted: contextMuted,
    isCameraOff: contextCameraOff,
    toggleMute,
    toggleCamera,
    isInitialized,
    initializeMedia
  } = useMedia();

  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingMedia, setIsLoadingMedia] = useState(!isInitialized);

  // Media State
  const localVideoRef = useRef<HTMLVideoElement>(null);

  // Use context stream instead of local state
  const localStream = contextStream;
  const isMuted = contextMuted;
  const isCameraOff = contextCameraOff;

  // WebRTC State
  const peerConnectionsRef = useRef<Map<string, PeerConnection>>(new Map());
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const socketRef = useRef<Socket | null>(null);

  // Invite State
  const [showInvitePopover, setShowInvitePopover] = useState(false);
  const [selectedUsersToInvite, setSelectedUsersToInvite] = useState<string[]>([]);

  // Filter users available to invite
  const availableUsersToInvite = allUsers.filter(u =>
    u.id !== currentUser.id && !participants.find(p => p.id === u.id) && u.status === 'online'
  );

  // Initialize Socket Connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[VideoModal] Socket connected');
    });

    socket.on('webrtc:offer', handleReceiveOffer);
    socket.on('webrtc:answer', handleReceiveAnswer);
    socket.on('webrtc:ice-candidate', handleReceiveIceCandidate);

    return () => {
      socket.disconnect();
    };
  }, []);

  // Initialize Media from Context
  useEffect(() => {
    const initMedia = async () => {
      console.log('[VideoModal] Checking media initialization');

      if (!isInitialized) {
        console.log('[VideoModal] Initializing media from context...');
        setIsLoadingMedia(true);
        try {
          await initializeMedia();
        } catch (err) {
          console.error('[VideoModal] Error initializing media:', err);
          setError('Erro ao inicializar mídia');
        } finally {
          setIsLoadingMedia(false);
        }
      } else {
        console.log('[VideoModal] Media already initialized');
        setIsLoadingMedia(false);
      }
    };

    initMedia();
  }, [isInitialized, initializeMedia]);

  // Update video ref when stream changes
  useEffect(() => {
    if (localVideoRef.current && localStream && !isCameraOff) {
      localVideoRef.current.srcObject = localStream;
    } else if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
  }, [localStream, isCameraOff]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Close all peer connections
      peerConnectionsRef.current.forEach(({ connection }) => {
        connection.close();
      });
      peerConnectionsRef.current.clear();
    };
  }, []);

  // Create peer connections when participants change
  useEffect(() => {
    if (localStream && participants.length > 0) {
      console.log('[VideoModal] Participants updated, creating peer connections:', participants.length);
      participants.forEach(participant => {
        if (!peerConnectionsRef.current.has(participant.id)) {
          console.log('[VideoModal] Creating new peer connection for:', participant.id);
          createPeerConnection(participant.id, localStream);
        }
      });
    }
  }, [participants, localStream]);

  // Create Peer Connection
  const createPeerConnection = async (targetUserId: string, stream: MediaStream) => {
    try {
      const peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Add local stream tracks
      stream.getTracks().forEach(track => {
        peerConnection.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc:ice-candidate', {
            targetUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Received remote track from', targetUserId);
        const [remoteStream] = event.streams;
        setRemoteStreams(prev => new Map(prev).set(targetUserId, remoteStream));
      };

      // Handle connection state
      peerConnection.onconnectionstatechange = () => {
        console.log(`[WebRTC] Connection state with ${targetUserId}:`, peerConnection.connectionState);
        if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
          console.log(`[WebRTC] Connection with ${targetUserId} failed/disconnected`);
        }
      };

      peerConnectionsRef.current.set(targetUserId, { connection: peerConnection, stream: null });

      // Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await peerConnection.setLocalDescription(offer);

      if (socketRef.current) {
        socketRef.current.emit('webrtc:offer', {
          targetUserId,
          offer: offer.toJSON(),
        });
      }
    } catch (err) {
      console.error('[WebRTC] Error creating peer connection:', err);
    }
  };

  // Handle Received Offer
  const handleReceiveOffer = async (data: { fromUserId: string; offer: RTCSessionDescriptionInit }) => {
    try {
      console.log('[WebRTC] Received offer from', data.fromUserId);

      if (!localStream) {
        console.error('[WebRTC] No local stream available');
        return;
      }

      const peerConnection = new RTCPeerConnection(ICE_SERVERS);

      // Add local stream
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit('webrtc:ice-candidate', {
            targetUserId: data.fromUserId,
            candidate: event.candidate.toJSON(),
          });
        }
      };

      // Handle remote stream
      peerConnection.ontrack = (event) => {
        console.log('[WebRTC] Received remote track from', data.fromUserId);
        const [remoteStream] = event.streams;
        setRemoteStreams(prev => new Map(prev).set(data.fromUserId, remoteStream));
      };

      peerConnectionsRef.current.set(data.fromUserId, { connection: peerConnection, stream: null });

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      if (socketRef.current) {
        socketRef.current.emit('webrtc:answer', {
          targetUserId: data.fromUserId,
          answer: answer.toJSON(),
        });
      }
    } catch (err) {
      console.error('[WebRTC] Error handling offer:', err);
    }
  };

  // Handle Received Answer
  const handleReceiveAnswer = async (data: { fromUserId: string; answer: RTCSessionDescriptionInit }) => {
    try {
      console.log('[WebRTC] Received answer from', data.fromUserId);
      const peer = peerConnectionsRef.current.get(data.fromUserId);
      if (peer) {
        await peer.connection.setRemoteDescription(new RTCSessionDescription(data.answer));
      }
    } catch (err) {
      console.error('[WebRTC] Error handling answer:', err);
    }
  };

  // Handle Received ICE Candidate
  const handleReceiveIceCandidate = async (data: { fromUserId: string; candidate: RTCIceCandidateInit }) => {
    try {
      const peer = peerConnectionsRef.current.get(data.fromUserId);
      if (peer) {
        await peer.connection.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (err) {
      console.error('[WebRTC] Error adding ICE candidate:', err);
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUsersToInvite(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSendInvite = () => {
    const users = allUsers.filter(u => selectedUsersToInvite.includes(u.id));
    onInvite(users);
    setShowInvitePopover(false);
    setSelectedUsersToInvite([]);
  };

  // Simulate transcription updates
  useEffect(() => {
    let interval: any;
    if (isTranscribing) {
      const phrases = [
        "Então, sobre as metas do Q3...",
        "Acho que precisamos refatorar o módulo de API.",
        "Alguém viu as últimas atualizações de design?",
        "Concordo, vamos seguir com esse plano.",
        "Você pode compartilhar sua tela, por favor?"
      ];
      interval = setInterval(() => {
        const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
        const speaker = participants[Math.floor(Math.random() * participants.length)]?.name || 'Desconhecido';
        setTranscription(prev => [...prev.slice(-4), `${speaker}: ${randomPhrase}`]);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isTranscribing, participants]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col animate-in fade-in zoom-in-95 duration-300">
      {/* Loading Screen */}
      {isLoadingMedia && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center">
          <div className="flex flex-col items-center gap-4 p-8 bg-slate-800/50 rounded-2xl border border-slate-700">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Video size={24} className="text-indigo-400" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-semibold mb-1">Iniciando chamada...</p>
              <p className="text-slate-400 text-sm">Aguarde enquanto conectamos você</p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-16 bg-slate-800 px-6 flex items-center justify-between border-b border-slate-700">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse shadow-lg shadow-red-500/50"></span>
          <div>
            <h3 className="text-white font-bold text-lg leading-tight">{roomName}</h3>
            <span className="text-slate-400 text-xs font-medium">{participants.length + 1} participantes</span>
          </div>
        </div>
        <div className="flex gap-2">
          {error && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/20 border border-red-500/30 rounded-full">
              <AlertCircle size={14} className="text-red-400" />
              <span className="text-red-300 text-xs font-medium">{error}</span>
            </div>
          )}
          <button
            onClick={() => setIsTranscribing(!isTranscribing)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${isTranscribing ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
          >
            <Wand2 size={14} />
            {isTranscribing ? 'Transcrição Ativa' : 'Ativar IA'}
          </button>
        </div>
      </header>

      {/* Main Video Grid */}
      <div className="flex-1 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
        {/* Current User (Me) */}
        <div className={`relative bg-slate-800 rounded-2xl overflow-hidden aspect-video border-2 transition-all shadow-xl group ${isMuted ? 'border-slate-700' : 'border-indigo-500'}`}>
          {isCameraOff || !localStream ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl text-slate-400 font-bold border-4 border-slate-600">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          ) : (
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform scale-x-[-1]"
            />
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span className="text-white text-sm font-semibold bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-2">
              Você
              {isMuted && <MicOff size={12} className="text-red-400" />}
            </span>
          </div>
        </div>

        {/* Remote Participants */}
        {participants.map(p => {
          const remoteStream = remoteStreams.get(p.id);
          return (
            <RemoteVideo key={p.id} participant={p} stream={remoteStream || null} />
          );
        })}

        {/* Empty State */}
        {participants.length === 0 && (
          <div className="flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-2xl aspect-video bg-slate-800/50">
            <Users size={32} className="mb-2 opacity-50" />
            <p>Aguardando outros participantes...</p>
          </div>
        )}
      </div>

      {/* Transcription Overlay */}
      {isTranscribing && transcription.length > 0 && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-2xl bg-black/70 backdrop-blur-md p-4 rounded-2xl text-white text-center shadow-2xl border border-white/10">
          <p className="text-indigo-300 text-[10px] mb-2 uppercase tracking-widest font-bold">Transcrição em Tempo Real</p>
          {transcription.map((t, i) => (
            <p key={i} className={`text-sm py-0.5 ${i === transcription.length - 1 ? 'text-white font-medium animate-in fade-in slide-in-from-bottom-1' : 'text-slate-400'}`}>{t}</p>
          ))}
        </div>
      )}

      {/* Controls Bar */}
      <footer className="h-24 bg-slate-800 border-t border-slate-700 flex items-center justify-center gap-4 relative z-20">
        <ControlBtn
          isActive={!isMuted}
          onClick={toggleMute}
          onIcon={Mic}
          offIcon={MicOff}
          label={isMuted ? "Desmutar Microfone" : "Mutar Microfone"}
          activeColor="bg-slate-700 text-white"
          inactiveColor="bg-red-500 text-white hover:bg-red-600"
        />

        <ControlBtn
          isActive={!isCameraOff}
          onClick={toggleCamera}
          onIcon={Video}
          offIcon={VideoOff}
          label={isCameraOff ? "Ligar Câmera" : "Desligar Câmera"}
          activeColor="bg-slate-700 text-white"
          inactiveColor="bg-red-500 text-white hover:bg-red-600"
        />

        <ControlBtn
          isActive={isScreenSharing}
          onClick={() => setIsScreenSharing(!isScreenSharing)}
          onIcon={Monitor}
          offIcon={Monitor}
          label="Compartilhar Tela"
          activeColor="bg-green-500 text-white"
          inactiveColor="bg-slate-700 text-slate-300"
        />

        <div className="w-px h-10 bg-slate-600 mx-4"></div>

        <ControlBtn
          isActive={false}
          onClick={() => {}}
          onIcon={MessageSquare}
          offIcon={MessageSquare}
          label="Chat"
          activeColor="bg-slate-700"
          inactiveColor="bg-slate-700 text-slate-300"
          badge={false}
        />

        {/* Invite Button */}
        <div className="relative">
          <ControlBtn
            isActive={showInvitePopover}
            onClick={() => setShowInvitePopover(!showInvitePopover)}
            onIcon={UserPlus}
            offIcon={UserPlus}
            label="Convidar Pessoas"
            activeColor="bg-indigo-600 text-white"
            inactiveColor="bg-slate-700 text-slate-300"
          />
          {showInvitePopover && (
            <div className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-72 bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 slide-in-from-bottom-2">
              <div className="p-3 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h4 className="font-bold text-slate-800 text-sm">Convidar para Sala</h4>
                <button onClick={() => setShowInvitePopover(false)} className="text-slate-400 hover:text-slate-600"><X size={16}/></button>
              </div>
              <div className="max-h-60 overflow-y-auto p-2 space-y-1">
                {availableUsersToInvite.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Ninguém disponível para convidar.</p>
                ) : availableUsersToInvite.map(user => (
                  <button
                    key={user.id}
                    onClick={() => toggleUserSelection(user.id)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-colors ${selectedUsersToInvite.includes(user.id) ? 'bg-indigo-50 border border-indigo-100' : 'hover:bg-slate-50 border border-transparent'}`}
                  >
                    <img src={user.avatar} className="w-8 h-8 rounded-full" />
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold truncate ${selectedUsersToInvite.includes(user.id) ? 'text-indigo-700' : 'text-slate-700'}`}>{user.name}</p>
                    </div>
                    {selectedUsersToInvite.includes(user.id) && <Check size={16} className="text-indigo-600" />}
                  </button>
                ))}
              </div>
              <div className="p-3 border-t border-slate-100 bg-slate-50">
                <button
                  disabled={selectedUsersToInvite.length === 0}
                  onClick={handleSendInvite}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-colors shadow-lg shadow-indigo-200"
                >
                  Enviar Convite ({selectedUsersToInvite.length})
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 ml-8">
          {onMinimize && (
            <button
              onClick={onMinimize}
              className="px-6 py-4 bg-slate-700 hover:bg-slate-600 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg transition-all hover:scale-105 active:scale-95 group"
              title="Minimizar Chamada"
            >
              <Minimize2 size={20} className="group-hover:animate-pulse" />
              <span className="hidden md:inline">Minimizar</span>
            </button>
          )}

          <button
            onClick={onLeave}
            className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95 group"
            title="Sair da Chamada"
          >
            <PhoneOff size={20} className="group-hover:animate-bounce" />
            <span className="hidden md:inline">Sair</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

// Remote Video Component
const RemoteVideo: React.FC<{ participant: User; stream: MediaStream | null }> = ({ participant, stream }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video border border-slate-700 shadow-lg">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
          <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl text-slate-400 font-bold border-4 border-slate-600">
            {participant.name.charAt(0)}
          </div>
        </div>
      )}
      {stream && (
        <div className="absolute top-4 right-4 bg-green-500/90 p-1.5 rounded-full animate-pulse shadow-sm backdrop-blur-sm">
          <Mic size={14} className="text-white" />
        </div>
      )}
      <div className="absolute bottom-4 left-4 text-white text-sm font-semibold bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md">
        {participant.name}
      </div>
    </div>
  );
};

// Control Button Component
const ControlBtn: React.FC<{
  isActive: boolean;
  onClick: () => void;
  onIcon: React.ElementType;
  offIcon: React.ElementType;
  label: string;
  activeColor: string;
  inactiveColor: string;
  badge?: boolean;
}> = ({ isActive, onClick, onIcon, offIcon, label, activeColor, inactiveColor, badge }) => {
  const Icon = isActive ? onIcon : offIcon;
  return (
    <div className="relative group flex flex-col items-center">
      <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-xl z-50">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
      </div>

      <button
        onClick={onClick}
        className={`p-4 rounded-2xl transition-all duration-200 transform hover:scale-105 active:scale-95 shadow-md ${isActive ? activeColor : inactiveColor}`}
      >
        <Icon size={24} />
        {badge && <span className="absolute top-3 right-3 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-slate-800"></span>}
      </button>
    </div>
  );
};
