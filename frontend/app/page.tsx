"use client";

import { useState, useEffect } from "react";
import Flashcard from "./components/Flashcard";
import Header from "./components/Header";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs"; 
import SaveModal from "./components/SaveModal";

export default function Home() {
    const { isSignedIn } = useUser();
    const [texto, setTexto] = useState("");
    const [flashcards, setFlashcards] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("Gerando Flashcards ✨");

    // O 'saving' agora é controlado dentro do Modal, mas mantemos aqui caso queira usar no botão principal para efeito visual
    const [saving, setSaving] = useState(false);

    // ESTADO DO MODAL
    const [showModal, setShowModal] = useState(false);

    // --- WAKE UP PING ---
    useEffect(() => {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
        fetch(`${baseUrl}/`).catch(() => { });
    }, []);

    // --- LOADING TEXT ---
    useEffect(() => {
        if (!loading) return;
        const mensagens = [
            "Acordando a IA... 😴",
            "Lendo seu texto... 📖",
            "Identificando conceitos chaves... 🧠",
            "Criando perguntas... ✍️",
            "Quase lá... 🚀"
        ];
        let i = 0;
        const interval = setInterval(() => {
            setLoadingText(mensagens[i % mensagens.length]);
            i++;
        }, 2500);
        return () => clearInterval(interval);
    }, [loading]);

    // --- FUNÇÃO GERAR ---
    async function gerarFlashcards() {
        if (!texto.trim()) return alert("Digite um texto para estudar!");

        setLoading(true);
        setFlashcards([]);

        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000);

            const response = await fetch(`${baseUrl}/api/gerar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                if (response.status === 504) throw new Error("Timeout: O servidor demorou.");
                throw new Error("Erro no servidor");
            }

            const data = await response.json();
            setFlashcards(data.cartoes);
        } catch (error: any) {
            console.error(error);
            if (error.name === 'AbortError' || error.message.includes("Timeout")) {
                alert("O servidor estava dormindo. Tente novamente agora que ele acordou! ⚡");
            } else {
                alert("Ocorreu um erro ao gerar. Tente novamente.");
            }
        } finally {
            setLoading(false);
            setLoadingText("Gerar Flashcards ✨");
        }
    }

    function handleSalvar() {
        setShowModal(true);
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12 relative">
            <Header />

            {/* --- ÁREA DE INPUT --- */}
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
                    className={`w-full mt-4 py-4 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 ${loading
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

            {/* --- ÁREA DE RESULTADOS --- */}
            {flashcards.length > 0 && (
                <div className="w-full max-w-5xl flex flex-col items-center gap-6">

                    {/* CTA DE SALVAR */}
                    <div className="w-full flex justify-center mt-4 mb-8">
                        {isSignedIn ? (
                            <button
                                onClick={handleSalvar}
                                disabled={saving}
                                className={`
                  group relative px-8 py-4 rounded-2xl font-bold text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0
                  ${saving ? "bg-gray-400 cursor-wait" : "bg-gradient-to-r from-green-500 to-emerald-600"}
                `}
                            >
                                <div className="flex items-center gap-3">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                    <span>Salvar na minha Coleção</span>
                                </div>
                            </button>
                        ) : (
                            // CTA PARA DESLOGADO
                            <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col md:flex-row items-center gap-6 max-w-2xl w-full hover:border-blue-200 transition-colors">
                                <div className="p-4 bg-blue-50 rounded-full">
                                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-lg font-bold text-gray-800">Não perca seu estudo!</h3>
                                    <p className="text-gray-500 text-sm mt-1">
                                        Crie uma conta gratuita para salvar estes flashcards e acessá-los de qualquer dispositivo.
                                    </p>
                                </div>
                                <SignInButton mode="modal">
                                    <button className="whitespace-nowrap px-6 py-3 rounded-xl bg-gray-900 text-white font-bold text-sm hover:bg-gray-800 transition-all shadow-md active:scale-95">
                                        Criar conta grátis
                                    </button>
                                </SignInButton>
                            </div>
                        )}
                    </div>

                    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
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
            )}

            {showModal && (
                <SaveModal
                    cards={flashcards}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => {
                        setShowModal(false);
                        alert("Salvo com sucesso na sua coleção! 🎉");
                    }}
                />
            )}
        </div>
    );
}