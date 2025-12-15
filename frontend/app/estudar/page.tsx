"use client";

import { useEffect, useState, Suspense } from "react";
import Header from "../components/Header";
import Flashcard from "../components/Flashcard";
import { buscarCartoesParaRevisar, registrarRevisao, contarTotalFlashcards } from "../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

// Componente interno que usa useSearchParams
function StudyContent() {
    const { isLoaded, isSignedIn } = useUser();
    const searchParams = useSearchParams();

    // Estados
    const [queue, setQueue] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [cardAtualIndex, setCardAtualIndex] = useState(0);
    const [finalizou, setFinalizou] = useState(false);
    const [totalCards, setTotalCards] = useState(0);

    // --- LEITURA DOS PARÂMETROS DA URL (v0.3.0) ---
    // 1. Decks (Modo Clássico)
    const deckIdsParam = searchParams.get('decks');     // Suporte a múltiplos (?decks=1,2,3)
    const singleDeckId = searchParams.get('deckId');    // Suporte a único (?deckId=1) [CORREÇÃO AQUI]
    
    // Normaliza para sempre ser um array de strings
    const deckIds = deckIdsParam 
        ? deckIdsParam.split(',') 
        : (singleDeckId ? [singleDeckId] : []);

    // 2. Planos e Tópicos (Modo Tutor)
    const planId = searchParams.get('planId') || undefined;
    const topicId = searchParams.get('topicId') || undefined;

    useEffect(() => {
        async function carregar() {
            if (!isLoaded || !isSignedIn) {
                setLoading(false);
                return;
            }

            try {
                // Passamos os novos filtros para o backend
                const [revisoes, total] = await Promise.all([
                    buscarCartoesParaRevisar(false, deckIds, planId, topicId),
                    contarTotalFlashcards(deckIds, planId, topicId)
                ]);

                setQueue(revisoes);
                setTotalCards(total);
            } catch (error) {
                console.error("Erro ao carregar sessão de estudo:", error);
            } finally {
                setLoading(false);
            }
        }
        carregar();
    }, [isLoaded, isSignedIn, deckIdsParam, singleDeckId, planId, topicId]); // Adicionado singleDeckId nas dependências

    const handleAvaliacao = async (avaliacao: 'errei' | 'dificil' | 'facil') => {
        const cardAtual = queue[cardAtualIndex];
        const nextIndex = cardAtualIndex + 1;

        // Otimista: Avança a UI antes do backend responder
        if (nextIndex < queue.length) {
            setCardAtualIndex(nextIndex);
        } else {
            setFinalizou(true);
        }

        // Chama o backend em segundo plano
        await registrarRevisao(cardAtual.id, avaliacao);
    };

    const handleEstudarMais = async () => {
        setLoading(true);
        // Modo Extra também respeita todos os filtros (Decks, Plano ou Tópico)
        const extras = await buscarCartoesParaRevisar(true, deckIds, planId, topicId);
        
        if (extras.length > 0) {
            setQueue(extras);
            setCardAtualIndex(0);
            setFinalizou(false);
        } else {
            alert("Não há mais cards disponíveis nestes baralhos/tópicos!");
        }
        setLoading(false);
    };

    // Título Dinâmico da Sessão
    const getSessionTitle = () => {
        if (topicId) return "Revisão de Tópico";
        if (planId) return "Estudo do Plano Completo";
        if (deckIds.length > 0) return `${deckIds.length} Baralho(s) Selecionado(s)`; // Agora vai cair aqui corretamente
        return "Modo Global (Tudo)";
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl text-center px-4">
            {/* Título da Sessão */}
            <div className="mb-6">
                <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1 block">
                    {getSessionTitle()}
                </span>
            </div>

            {!finalizou && queue.length > 0 ? (
                <>
                    <div className="mb-6 flex justify-between items-end px-2">
                        <h1 className="text-2xl font-bold text-foreground">Modo Estudo 🧠</h1>
                        <span className="text-sm font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                            {cardAtualIndex + 1} / {queue.length}
                        </span>
                    </div>

                    <div className="mb-8">
                        <Flashcard
                            key={queue[cardAtualIndex].id}
                            index={cardAtualIndex}
                            frente={queue[cardAtualIndex].frente}
                            verso={queue[cardAtualIndex].verso}
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* POLISH: Changed bg-red-100 to bg-red-50 for lighter mode, preserved dark mode logic but ensured harmony */}
                        <button onClick={() => handleAvaliacao('errei')} className="py-4 bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-bold rounded-xl hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors border border-red-200 dark:border-red-800 active:scale-95">
                            Errei 😓
                        </button>
                        {/* POLISH: Changed bg-yellow-100 to bg-yellow-50 */}
                        <button onClick={() => handleAvaliacao('dificil')} className="py-4 bg-yellow-50 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 font-bold rounded-xl hover:bg-yellow-100 dark:hover:bg-yellow-900/50 transition-colors border border-yellow-200 dark:border-yellow-800 active:scale-95">
                            Difícil 😐
                        </button>
                        {/* POLISH: Changed bg-green-100 to bg-green-50 */}
                        <button onClick={() => handleAvaliacao('facil')} className="py-4 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold rounded-xl hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-800 active:scale-95">
                            Fácil 🤩
                        </button>
                    </div>
                </>
            ) : (
                <div className="bg-card p-10 rounded-3xl shadow-xl border border-border text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {totalCards === 0 ? (
                        <>
                            <div className="text-6xl mb-4">📭</div>
                            <h2 className="text-2xl font-bold text-card-foreground mb-2">
                                Nada por aqui
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                                Não há cartões para estudar nesta seleção. Que tal criar novos conteúdos?
                            </p>
                            
                            {/* Botão de Voltar Inteligente */}
                            <Link href={planId ? `/planos/${planId}` : "/colecao"}>
                                <button className="w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition shadow-lg active:scale-95">
                                    {planId ? "Voltar ao Plano" : "Voltar para Coleção"}
                                </button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="text-6xl mb-4 animate-bounce">🎉</div>
                            <h2 className="text-2xl font-bold text-card-foreground mb-2">
                                Sessão Finalizada!
                            </h2>
                            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                                Tudo revisado por aqui.
                                <br />
                                <span className="text-sm opacity-75">
                                    Total nesta seleção: {totalCards} cartas.
                                </span>
                            </p>

                            <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                <button
                                    onClick={handleEstudarMais}
                                    className="w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition shadow-lg shadow-primary/20 active:scale-95"
                                >
                                    🚀 Estudar Mais (+20)
                                </button>

                                {/* Botão Voltar Contextual */}
                                <Link href={planId ? `/planos/${planId}` : "/colecao"}>
                                    <button className="w-full bg-card text-foreground border border-border px-6 py-3.5 rounded-xl font-bold hover:bg-muted transition active:scale-95">
                                        {planId ? "Voltar ao Roteiro" : "Voltar para Coleção"}
                                    </button>
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

// Componente Principal
export default function EstudarPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-12 transition-colors duration-300">
            <Header />
            <Suspense fallback={<div className="text-center p-10 text-muted-foreground">Carregando ambiente de estudo...</div>}>
                <StudyContent />
            </Suspense>
        </div>
    );
}
