'use client';
import { useEffect, useState } from 'react';
import { Download } from 'lucide-react'; // Ícone de download

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Escuta o evento do Chrome/Edge que diz "Posso instalar!"
    const handler = (e: any) => {
      e.preventDefault(); // Impede o navegador de mostrar a barra nativa feia
      setDeferredPrompt(e);
      setIsVisible(true); // Mostra nosso botão
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    // Mostra o prompt nativo de instalação
    deferredPrompt.prompt();

    // Espera a escolha do usuário
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsVisible(false); // Esconde o botão se aceitou
    }
    
    setDeferredPrompt(null);
  };

  if (!isVisible) return null;

  return (
    <button
      onClick={handleInstall}
      className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-lg hover:bg-indigo-700 transition-all animate-bounce"
    >
      <Download className="w-5 h-5" />
      <span className="font-bold">Instalar App</span>
    </button>
  );
}