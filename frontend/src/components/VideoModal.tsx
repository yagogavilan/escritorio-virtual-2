
import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Monitor, Users, MessageSquare, Wand2, UserPlus, Check, X } from 'lucide-react';
import { User } from '../types';

interface VideoModalProps {
  currentUser: User;
  participants: User[];
  roomName: string;
  allUsers: User[];
  onLeave: () => void;
  onInvite: (users: User[]) => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({ currentUser, participants, roomName, allUsers, onLeave, onInvite }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [transcription, setTranscription] = useState<string[]>([]);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  // Media State
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Invite State
  const [showInvitePopover, setShowInvitePopover] = useState(false);
  const [selectedUsersToInvite, setSelectedUsersToInvite] = useState<string[]>([]);

  // Filter users available to invite (not me, not already in call)
  const availableUsersToInvite = allUsers.filter(u => 
    u.id !== currentUser.id && !participants.find(p => p.id === u.id)
  );

  // --- Real Media Stream Logic ---
  useEffect(() => {
    let stream: MediaStream | null = null;

    const startMedia = async () => {
        try {
            // Request both video and audio
            stream = await navigator.mediaDevices.getUserMedia({ 
                video: true, 
                audio: true 
            });
            setMediaStream(stream);
            
            // Attach to video element
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
        } catch (err) {
            console.error("Error accessing media devices:", err);
            setIsCameraOff(true); // Fallback to avatar if permission denied or no camera
        }
    };

    if (!isCameraOff) {
        startMedia();
    } else {
        // If camera toggled off, stop video tracks but keep stream if needed, 
        // or just clear stream for this demo logic
        setMediaStream(null);
    }

    return () => {
        // Cleanup: Stop all tracks when component unmounts or camera toggles
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        if (mediaStream) {
             mediaStream.getTracks().forEach(track => track.stop());
        }
    };
  }, [isCameraOff]);

  // Handle Mute Toggle (Real Audio Track)
  useEffect(() => {
      if (mediaStream) {
          mediaStream.getAudioTracks().forEach(track => {
              track.enabled = !isMuted;
          });
      }
  }, [isMuted, mediaStream]);


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
          {isCameraOff ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
              <div className="w-24 h-24 rounded-full bg-slate-700 flex items-center justify-center text-3xl text-slate-400 font-bold border-4 border-slate-600">
                {currentUser.name.charAt(0)}
              </div>
            </div>
          ) : (
             /* Real Video Element */
            <video 
                ref={localVideoRef}
                autoPlay 
                playsInline 
                muted // Muted locally to prevent echo
                className="w-full h-full object-cover transform scale-x-[-1]" // Mirror effect
            />
          )}
          
          <div className="absolute bottom-4 left-4 flex items-center gap-2">
            <span className="text-white text-sm font-semibold bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md flex items-center gap-2">
                Você
                {isMuted && <MicOff size={12} className="text-red-400" />}
            </span>
          </div>
        </div>

        {/* Other Participants */}
        {participants.map(p => (
          <div key={p.id} className="relative bg-slate-800 rounded-2xl overflow-hidden aspect-video border border-slate-700 shadow-lg">
             <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
             {/* Simulated talking indicator */}
             <div className="absolute top-4 right-4 bg-green-500/90 p-1.5 rounded-full animate-pulse shadow-sm backdrop-blur-sm">
                <Mic size={14} className="text-white" />
             </div>
             <div className="absolute bottom-4 left-4 text-white text-sm font-semibold bg-black/60 px-2.5 py-1 rounded-lg backdrop-blur-md">
                {p.name}
             </div>
          </div>
        ))}
        
        {/* Empty State / Placeholder */}
        {participants.length === 0 && (
            <div className="flex flex-col items-center justify-center text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded-2xl aspect-video bg-slate-800/50">
                <Users size={32} className="mb-2 opacity-50" />
                <p>Aguardando outros...</p>
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
            onClick={() => setIsMuted(!isMuted)} 
            onIcon={Mic} 
            offIcon={MicOff}
            label={isMuted ? "Desmutar Microfone" : "Mutar Microfone"}
            activeColor="bg-slate-700 text-white"
            inactiveColor="bg-red-500 text-white hover:bg-red-600"
        />
        
        <ControlBtn 
            isActive={!isCameraOff} 
            onClick={() => setIsCameraOff(!isCameraOff)} 
            onIcon={Video} 
            offIcon={VideoOff}
            label={isCameraOff ? "Ligar Câmera" : "Desligar Câmera"}
            activeColor="bg-slate-700 text-white"
            inactiveColor="bg-red-500 text-white hover:bg-red-600"
        />

        {/* TODO: Implementar compartilhamento de tela real usando WebRTC
            Atualmente apenas alterna o estado local. Implementação completa requer:
            1. Capturar stream da tela com navigator.mediaDevices.getDisplayMedia()
            2. Adicionar track de vídeo da tela ao peer connection
            3. Sinalizar para outros participantes que está compartilhando tela
            4. Substituir feed de vídeo da câmera pelo feed da tela
            5. Gerenciar transição entre câmera e tela
        */}
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

        {/* TODO: Implementar chat durante videochamada
            O backend já tem suporte a canais de chat (channelsApi).
            Para integrar chat nas reuniões:
            1. Criar ou reutilizar canal de chat para a sala de reunião
            2. Adicionar sidebar/drawer com mensagens durante a chamada
            3. Usar channelsApi.getMessages() para carregar histórico
            4. Usar channelsApi.sendMessage() para enviar mensagens
            5. Usar WebSocket para receber mensagens em tempo real
            6. Adicionar notificação visual de novas mensagens (badge)
        */}
        <ControlBtn
            isActive={false}
            onClick={() => {}}
            onIcon={MessageSquare}
            offIcon={MessageSquare}
            label="Chat"
            activeColor="bg-slate-700"
            inactiveColor="bg-slate-700 text-slate-300"
            badge={true}
        />

        {/* Invite Button with Popover */}
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

        <button 
            onClick={onLeave}
            className="ml-8 px-8 py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-lg shadow-red-900/20 transition-all hover:scale-105 active:scale-95 group"
            title="Sair da Chamada"
        >
            <PhoneOff size={20} className="group-hover:animate-bounce" /> 
            <span className="hidden md:inline">Sair</span>
        </button>
      </footer>
    </div>
  );
};

// Helper Component for Control Buttons with Tooltip
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
            {/* Tooltip */}
            <div className="absolute bottom-full mb-3 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-xs font-bold px-2 py-1 rounded-lg pointer-events-none whitespace-nowrap shadow-xl">
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
    )
}
