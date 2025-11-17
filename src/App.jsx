import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Power, Loader2 } from 'lucide-react';
import { AvaturnHead } from '@avaturn-live/web-sdk';

// URL de l'API - utilise l'URL Render en production, localhost en dev
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://avaturn-escape-game.onrender.com';

function App() {
  const [session, setSession] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [avatarReady, setAvatarReady] = useState(false);
  const [triggerSend, setTriggerSend] = useState(0);
  
  const recognitionRef = useRef(null);
  const avatarContainerRef = useRef(null);
  const avatarRef = useRef(null);
  const pendingTranscriptRef = useRef('');

  // Envoyer du texte à l'avatar avec ChatGPT
  const handleSendToAvatar = useCallback(async (text) => {
    if (!session || !text.trim()) {
      console.log('Impossible d\'envoyer:', { session: !!session, text: text?.trim() });
      return;
    }

    try {
      console.log('Envoi message à ChatGPT:', text.trim());
      
      // Ajouter le message utilisateur à l'historique
      setHistory(prev => [...prev, { 
        text: text.trim(), 
        sender: 'user',
        timestamp: new Date() 
      }]);

      // Envoyer à ChatGPT via l'API
      const response = await fetch(`${API_BASE_URL}/api/session/${session.session_id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: text.trim() }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de l\'envoi du message');
      }

      const data = await response.json();
      console.log('Réponse ChatGPT:', data.response);
      
      // Ajouter la réponse de l'avatar à l'historique
      setHistory(prev => [...prev, { 
        text: data.response, 
        sender: 'avatar',
        taskId: data.task_id, 
        timestamp: new Date() 
      }]);

      setTranscript('');
    } catch (err) {
      console.error('Erreur envoi:', err);
      setError(err.message);
    }
  }, [session]);

  // Initialiser la reconnaissance vocale
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'fr-FR';

      recognitionRef.current.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
          } else {
            interimTranscript += transcript;
          }
        }

        if (finalTranscript) {
          const textToSend = finalTranscript.trim();
          console.log('Texte finalisé:', textToSend);
          setTranscript(''); // Réinitialiser l'affichage
          // Envoyer immédiatement
          if (textToSend) {
            pendingTranscriptRef.current = textToSend;
            setTriggerSend(prev => prev + 1); // Déclencher l'envoi
          }
        } else {
          setTranscript(interimTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error('Erreur reconnaissance vocale:', event.error);
        setIsListening(false);
        if (event.error !== 'no-speech') {
          setError(`Erreur: ${event.error}`);
        }
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    } else {
      setError('La reconnaissance vocale n\'est pas supportée par votre navigateur');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // Initialiser l'avatar quand la session est créée et le container est prêt
  useEffect(() => {
    if (session && session.token && avatarContainerRef.current && !avatarRef.current) {
      console.log('Initialisation de l\'avatar...');
      initializeAvatar(session.token);
    }
  }, [session]);

  // Envoyer le texte transcrit quand triggerSend change
  useEffect(() => {
    if (triggerSend > 0 && pendingTranscriptRef.current && session && avatarReady) {
      const textToSend = pendingTranscriptRef.current;
      pendingTranscriptRef.current = '';
      console.log('Envoi du texte transcrit:', textToSend);
      handleSendToAvatar(textToSend);
    }
  }, [triggerSend, session, avatarReady, handleSendToAvatar]);

  // Initialiser l'avatar avec le SDK
  const initializeAvatar = async (token) => {
    if (!avatarContainerRef.current) {
      console.error('Container non disponible');
      setAvatarReady(true);
      return;
    }

    try {
      const avaturnHead = new AvaturnHead(avatarContainerRef.current, {
        sessionToken: token,
        apiHost: 'https://api.avaturn.live',
        preloadBundle: true,
      });

      avaturnHead.on('init', () => {
        console.log('Avatar initialisé');
      });

      avaturnHead.on('avatar_started_speaking', () => {
        console.log('Avatar a commencé à parler');
      });

      avaturnHead.on('avatar_ended_speaking', () => {
        console.log('Avatar a arrêté de parler');
      });

      await avaturnHead.init();
      avatarRef.current = avaturnHead;
      console.log('Avatar prêt');
      setAvatarReady(true);
    } catch (err) {
      console.error('Erreur initialisation avatar:', err);
      setError('Erreur lors de l\'initialisation de l\'avatar: ' + err.message);
      setAvatarReady(true);
    }
  };

  // Créer une session Avaturn
  const createSession = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/session/create`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la création de la session');
      }
      
      const data = await response.json();
      setSession(data);
      // L'avatar sera initialisé via useEffect quand le container sera prêt
    } catch (err) {
      setError(err.message);
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Terminer la session
  const terminateSession = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      // Nettoyer l'avatar
      if (avatarRef.current) {
        avatarRef.current = null;
      }
      
      await fetch(`${API_BASE_URL}/api/session/${session.session_id}`, {
        method: 'DELETE',
      });
      setSession(null);
      setHistory([]);
      setAvatarReady(false);
      if (isListening) {
        toggleListening();
      }
    } catch (err) {
      setError(err.message);
      console.error('Erreur:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle reconnaissance vocale
  const toggleListening = () => {
    if (!session) {
      setError('Créez d\'abord une session');
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setError(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // Écouter la touche Espace pour Push-to-Talk (maintenir pour parler)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && session && !isListening && !e.repeat) {
        e.preventDefault();
        // Démarrer l'enregistrement
        setError(null);
        recognitionRef.current?.start();
        setIsListening(true);
      }
    };

    const handleKeyUp = (e) => {
      if (e.code === 'Space' && session && isListening) {
        e.preventDefault();
        // Arrêter l'enregistrement
        recognitionRef.current?.stop();
        setIsListening(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [session, isListening]);

  return (
    <div className="h-screen bg-black relative overflow-hidden flex flex-col">
      {/* Background sombre avec overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-red-950 via-black to-gray-900 opacity-90"></div>
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1509248961158-e54f6934749c?w=1920')] bg-cover bg-center opacity-20 mix-blend-overlay"></div>
      
      {/* Vignette effect */}
      <div className="absolute inset-0 shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]"></div>

      {/* Header sombre */}
      <header className="relative z-10 border-b border-red-900/30 bg-black/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-red-500 tracking-wider font-mono">
                METAGORA OBSESSION
              </h1>
              <p className="text-red-300/60 text-sm mt-1 font-mono">Escape Game - Session Active</p>
            </div>
            {session && (
              <button
                onClick={terminateSession}
                disabled={isLoading}
                className="flex items-center gap-2 px-6 py-3 bg-red-900/80 text-red-100 rounded border border-red-700 hover:bg-red-800 transition-all disabled:opacity-50 font-mono"
              >
                <Power size={20} />
                TERMINER
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 overflow-hidden">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-950/80 border border-red-800 rounded text-red-300 backdrop-blur-sm font-mono">
            ⚠️ {error}
          </div>
        )}

        {/* Session Control */}
        {!session ? (
          <div className="text-center py-20">
            <div className="bg-black/70 backdrop-blur-md rounded border border-red-900/50 shadow-2xl shadow-red-900/50 p-12 max-w-lg mx-auto">
              <div className="mb-6">
                <div className="text-6xl mb-4 animate-pulse">🔴</div>
                <h2 className="text-2xl font-bold mb-2 text-red-500 font-mono tracking-wider">INITIALISER LA SESSION</h2>
                <p className="text-red-300/70 text-sm font-mono">
                  Préparez-vous à rencontrer Sophie...
                </p>
              </div>
              <button
                onClick={createSession}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-red-900/80 text-red-100 rounded border-2 border-red-700 hover:bg-red-800 hover:border-red-600 transition-all disabled:opacity-50 font-mono text-lg tracking-wider shadow-lg shadow-red-900/50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="animate-spin" size={24} />
                    CONNEXION EN COURS...
                  </>
                ) : (
                  <>
                    <Power size={24} />
                    DÉMARRER
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col">
            {/* Avatar Container - 80% de la fenêtre */}
            <div className="flex-1 bg-black/80 backdrop-blur-sm border-2 border-red-900/50 shadow-2xl shadow-red-900/50 overflow-hidden flex flex-col">
              <div className="relative flex-1">
                {/* Header de l'avatar */}
                <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/90 to-transparent p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></div>
                      <span className="text-red-400 font-mono text-sm tracking-wider">LIVE SESSION</span>
                    </div>
                    <div className="text-red-500/60 font-mono text-xs">
                      {new Date().toLocaleTimeString('fr-FR')}
                    </div>
                  </div>
                </div>

                {/* Zone vidéo de l'avatar */}
                <div className="w-full h-full bg-black relative">
                  <div 
                    ref={avatarContainerRef}
                    className="w-full h-full absolute inset-0"
                    id="avaturn-container"
                  />
                  {!avatarReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                      <div className="text-center">
                        <Loader2 className="animate-spin mx-auto mb-4 text-red-500" size={48} />
                        <p className="text-red-400 font-mono tracking-wider">CHARGEMENT DE SOPHIE...</p>
                        <p className="text-red-600/60 text-sm mt-2 font-mono">Initialisation du contact</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Overlay de glitch effect */}
                <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-black/50 via-transparent to-black/30"></div>
              </div>
              
              {/* Voice Control */}
              <div className="p-4 bg-black/50 border-t border-red-900/30">
                <div className="flex items-center justify-center gap-6">
                  <button
                    onClick={toggleListening}
                    className={`inline-flex items-center gap-3 px-10 py-4 rounded border-2 font-mono text-lg tracking-wider transition-all transform hover:scale-105 shadow-lg ${
                      isListening 
                        ? 'bg-red-900/80 border-red-600 text-red-100 animate-pulse shadow-red-900/50' 
                        : 'bg-black/80 border-red-800/50 text-red-400 hover:border-red-700 shadow-red-950/50'
                    }`}
                  >
                    {isListening ? (
                      <>
                        <MicOff size={28} />
                        EN ÉCOUTE...
                      </>
                    ) : (
                      <>
                        <Mic size={28} />
                        MAINTENIR [ESPACE]
                      </>
                    )}
                  </button>
                  
                  {/* Live Transcript */}
                  {transcript && (
                    <div className="flex-1 max-w-2xl p-3 bg-red-950/30 rounded border border-red-900/50 backdrop-blur-sm">
                      <p className="text-sm text-red-200 font-mono">{transcript}</p>
                    </div>
                  )}

                  {/* Indicateur d'activité */}
                  {isListening && !transcript && (
                    <div className="flex items-center gap-2 text-red-400/70 text-sm font-mono">
                      <div className="flex gap-1">
                        <div className="w-1 h-4 bg-red-500 animate-pulse"></div>
                        <div className="w-1 h-4 bg-red-500 animate-pulse" style={{animationDelay: '0.2s'}}></div>
                        <div className="w-1 h-4 bg-red-500 animate-pulse" style={{animationDelay: '0.4s'}}></div>
                      </div>
                      Sophie écoute...
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
