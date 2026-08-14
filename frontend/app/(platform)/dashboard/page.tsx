"use client";

import { useState, useEffect, useRef } from "react";
import Flashcard from "@/app/components/Flashcard";
import { useUser } from "@clerk/nextjs";
import { SignInButton } from "@clerk/nextjs";
import SaveModal from "@/app/components/SaveModal";

export default function Home() {
    const { isSignedIn } = useUser();
    const [texto, setTexto] = useState("");
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [flashcards, setFlashcards] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingText, setLoadingText] = useState("Gerando Flashcards ✨");
    const [erro, setErro] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [saving, setSaving] = useState(false);
    const [showModal, setShowModal] = useState(false);

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

    async function gerarFlashcards() {
        setErro("");
        setFlashcards([]);

        if (!texto.trim() && !arquivo) {
            return setErro("Por favor, cole um texto ou anexe um PDF para começar.");
        }

        setLoading(true);

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 90000);

            const formData = new FormData();
            if (arquivo) formData.append("arquivo", arquivo);
            else formData.append("texto", texto);

            const response = await fetch("/api/ai/gerar", {
                method: "POST",
                body: formData,
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const mensagemErro = errorData.detail || "Ocorreu um erro ao processar.";
                if (response.status === 504) throw new Error("O servidor demorou muito. Tente um arquivo menor.");
                if (response.status === 422) throw new Error(mensagemErro);
                throw new Error(mensagemErro);
            }

            const data = await response.json();
            setFlashcards(data.cartoes);

            if (arquivo) {
                setArquivo(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        } catch (error: any) {
            console.error(error);
            if (error.name === "AbortError") setErro("Tempo esgotado! Tente um texto menor.");
            else setErro(error.message);
        } finally {
            setLoading(false);
            setLoadingText("Gerar Flashcards ✨");
        }
    }

    function handleSalvar() {
        setShowModal(true);
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-12 relative transition-colors duration-300">
            <div className="w-full max-w-3xl bg-card p-4 md:p-6 rounded-2xl shadow-xl border border-border mb-10 transition-all hover:shadow-2xl">
                {arquivo ? (
                    <div className="w-full h-40 flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-xl bg-primary/10 mb-4 animate-in fade-in" role="status" aria-live="polite">
                        <span className="text-4xl mb-2" aria-hidden="true">📄</span>
                        <p className="font-bold text-card-foreground">{arquivo.name}</p>
                        <button
                            type="button"
                            onClick={() => setArquivo(null)}
                            className="text-sm text-destructive hover:underline mt-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        >
                            Remover PDF e usar texto
                        </button>
                    </div>
                ) : (
                    <>
                        <label htmlFor="study-material" className="sr-only">Conteúdo para gerar flashcards</label>
                        <textarea
                            id="study-material"
                            className="w-full h-40 p-4 border border-input rounded-xl focus:border-ring focus:ring-2 focus:ring-ring/20 outline-none resize-none text-foreground bg-background transition-all text-lg"
                            placeholder="Cole seu texto de estudo aqui..."
                            value={texto}
                            onChange={(e) => setTexto(e.target.value)}
                        />
                    </>
                )}

                <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <div className="relative">
                        <input
                            type="file"
                            id="file-upload"
                            accept=".pdf"
                            className="sr-only"
                            ref={fileInputRef}
                            disabled={loading}
                            onChange={(e) => {
                                if (e.target.files?.[0]) {
                                    setArquivo(e.target.files[0]);
                                    setTexto("");
                                }
                            }}
                        />
                        <label
                            htmlFor="file-upload"
                            className={`cursor-pointer w-full sm:w-auto px-4 py-4 rounded-xl border border-input hover:bg-accent text-muted-foreground flex items-center justify-center transition-colors h-full focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring ${loading ? "pointer-events-none opacity-50" : ""}`}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span className="sr-only">Anexar arquivo PDF</span>
                        </label>
                    </div>

                    <button
                        type="button"
                        onClick={gerarFlashcards}
                        disabled={loading}
                        aria-busy={loading}
                        className={`w-full sm:flex-1 py-4 rounded-xl font-bold text-primary-foreground transition-all transform active:scale-[0.98] flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${loading
                            ? "bg-muted cursor-wait animate-pulse"
                            : "bg-linear-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-lg shadow-blue-500/30"
                            }`}
                    >
                        {loading && (
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        )}
                        {loading ? loadingText : (arquivo ? "Gerar do PDF ✨" : "Gerar Flashcards ✨")}
                    </button>
                </div>

                {loading && (
                    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">{loadingText}</p>
                )}
            </div>

            {erro && (
                <div role="alert" aria-live="assertive" className="w-full max-w-3xl mb-8 p-4 bg-destructive/10 border-l-4 border-destructive text-destructive rounded-r shadow-sm flex items-center gap-3 animate-in slide-in-from-top-2">
                    <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    <div>
                        <p className="font-bold">Ops!</p>
                        <p>{erro}</p>
                    </div>
                </div>
            )}

            {flashcards.length > 0 && (
                <div className="w-full max-w-5xl flex flex-col items-center gap-6">
                    <div className="w-full flex justify-center mt-4 mb-8">
                        {isSignedIn ? (
                            <button
                                type="button"
                                onClick={handleSalvar}
                                disabled={saving}
                                className={`group relative w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${saving ? "bg-muted cursor-wait" : "bg-success-solid"}`}
                            >
                                <div className="flex items-center justify-center gap-3">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg>
                                    <span>Salvar na minha Coleção</span>
                                </div>
                            </button>
                        ) : (
                            <div className="bg-card p-6 rounded-2xl shadow-lg border border-border flex flex-col md:flex-row items-center gap-6 max-w-2xl w-full hover:border-primary/50 transition-colors">
                                <div className="p-4 bg-primary/10 rounded-full" aria-hidden="true">
                                    <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                                </div>
                                <div className="flex-1 text-center md:text-left">
                                    <h3 className="text-lg font-bold text-card-foreground">Não perca seu estudo!</h3>
                                    <p className="text-muted-foreground text-sm mt-1">Crie uma conta gratuita para salvar estes flashcards e acessá-los de qualquer dispositivo.</p>
                                </div>
                                <SignInButton mode="modal">
                                    <button type="button" className="whitespace-nowrap w-full md:w-auto px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-all shadow-md active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                                        Criar conta grátis
                                    </button>
                                </SignInButton>
                            </div>
                        )}
                    </div>

                    <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {flashcards.map((card: any, index) => (
                            <Flashcard key={index} index={index} frente={card.frente} verso={card.verso} />
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