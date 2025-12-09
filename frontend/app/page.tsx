"use client";

import { useState, useEffect } from "react";
import Flashcard from "./components/Flashcard";

export default function Home() {
  const [texto, setTexto] = useState("");
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Gerando Flashcards ✨");

  // --- WAKE UP (Acordar o servidor) ---
  useEffect(() => {
    // Dispara um ping silencioso assim que a página carrega
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
    fetch(`${baseUrl}/`)
      .then(() => console.log("Servidor acordado! ☕"))
      .catch(() => console.log("Servidor dormindo ou erro de conexão..."));
  }, []);

  // --- EFEITO DE MENSAGENS ALEATÓRIAS ---
  useEffect(() => {
    if (!loading) return;
    
    const mensagens = [
      "Acordando a IA...",
      "Lendo seu texto...",
      "Identificando conceitos chaves...",
      "Criando perguntas...",
      "Quase lá..."
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      setLoadingText(mensagens[i % mensagens.length]);
      i++;
    }, 2500); // Muda a frase a cada 2.5 segundos

    return () => clearInterval(interval);
  }, [loading]);

  async function gerarFlashcards() {
    if (!texto.trim()) return alert("Digite um texto para estudar!");
    
    setLoading(true);
    setFlashcards([]); // Limpa os anteriores
    
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
      
      // Adicionamos um timeout manual no fetch para avisar se demorar demais
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos limite

      const response = await fetch(`${baseUrl}/api/gerar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 504) throw new Error("Timeout: O servidor demorou muito.");
        throw new Error("Erro no servidor");
      }

      const data = await response.json();
      setFlashcards(data.cartoes);
    } catch (error: any) {
      console.error(error);
      if (error.name === 'AbortError' || error.message.includes("Timeout")) {
        alert("O servidor estava dormindo e demorou para responder. Por favor, tente novamente agora que ele acordou! ⚡");
      } else {
        alert("Ocorreu um erro ao gerar. Tente novamente.");
      }
    } finally {
      setLoading(false);
      setLoadingText("Gerar Flashcards ✨");
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
      <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 mb-2">
        StudyFlash AI ⚡
      </h1>
      <p className="text-gray-500 mb-8 text-center">Cole seu texto e deixe a IA criar seu material de estudo.</p>

      {/* Área de Input */}
      <div className="w-full max-w-3xl bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-10 transition-all hover:shadow-2xl">
        <textarea
          className="w-full h-40 p-4 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-700 transition-all text-lg"
          placeholder="Cole seu texto de estudo aqui..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        
        <button
          onClick={gerarFlashcards}
          disabled={loading}
          className={`w-full mt-4 py-4 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${
            loading 
              ? "bg-gray-800 cursor-wait animate-pulse" 
              : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30"
          }`}
        >
          {loading && (
            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          )}
          {loading ? loadingText : "Gerar Flashcards ✨"}
        </button>
      </div>

      {/* GRID DE FLASHCARDS */}
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {flashcards.map((card: any, index) => (
          <Flashcard 
            key={index} 
            index={index}
            frente={card.frente} 
            verso={card.verso} 
          />
        ))}
      </div>
    </div>
  );
}