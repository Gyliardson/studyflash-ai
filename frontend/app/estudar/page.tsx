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
    const deckIdsParam = searchParams.get('decks');
    const deckIds = deckIdsParam ? deckIdsParam.split(',') : [];

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
    }, [isLoaded, isSignedIn, deckIdsParam, planId, topicId]);

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
        if (deckIds.length > 0) return `${deckIds.length} Baralho(s) Selecionado(s)`;
        return "Modo Global (Tudo)";
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl text-center">
            {/* Título da Sessão */}
            <div className="mb-6">
                <span className="text-xs font-bold text-blue-500 tracking-widest uppercase mb-1 block">
                    {getSessionTitle()}
                </span>
            </div>

            {!finalizou && queue.length > 0 ? (
                <>
                    <div className="mb-6 flex justify-between items-end px-2">
                        <h1 className="text-2xl font-bold text-gray-800">Modo Estudo 🧠</h1>
                        <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
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

                    <div className="grid grid-cols-3 gap-4">
                        <button onClick={() => handleAvaliacao('errei')} className="py-4 bg-red-100 text-red-700 font-bold rounded-xl hover:bg-red-200 transition-colors border border-red-200 active:scale-95">
                            Errei 😓
                        </button>
                        <button onClick={() => handleAvaliacao('dificil')} className="py-4 bg-yellow-100 text-yellow-800 font-bold rounded-xl hover:bg-yellow-200 transition-colors border border-yellow-200 active:scale-95">
                            Difícil 😐
                        </button>
                        <button onClick={() => handleAvaliacao('facil')} className="py-4 bg-green-100 text-green-700 font-bold rounded-xl hover:bg-green-200 transition-colors border border-green-200 active:scale-95">
                            Fácil 🤩
                        </button>
                    </div>
                </>
            ) : (
                <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {totalCards === 0 ? (
                        <>
                            <div className="text-6xl mb-4">📭</div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                Nada por aqui
                            </h2>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                Não há cartões para estudar nesta seleção. Que tal criar novos conteúdos?
                            </p>
                            
                            {/* Botão de Voltar Inteligente */}
                            <Link href={planId ? `/planos/${planId}` : "/colecao"}>
                                <button className="w-full bg-blue-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg active:scale-95">
                                    {planId ? "Voltar ao Plano" : "Voltar para Coleção"}
                                </button>
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="text-6xl mb-4 animate-bounce">🎉</div>
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">
                                Sessão Finalizada!
                            </h2>
                            <p className="text-gray-500 mb-8 max-w-md mx-auto">
                                Tudo revisado por aqui.
                                <br />
                                <span className="text-sm opacity-75">
                                    Total nesta seleção: {totalCards} cartas.
                                </span>
                            </p>

                            <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                <button
                                    onClick={handleEstudarMais}
                                    className="w-full bg-indigo-600 text-white px-6 py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 active:scale-95"
                                >
                                    🚀 Estudar Mais (+20)
                                </button>

                                {/* Botão Voltar Contextual */}
                                <Link href={planId ? `/planos/${planId}` : "/colecao"}>
                                    <button className="w-full bg-white text-gray-700 border border-gray-200 px-6 py-3.5 rounded-xl font-bold hover:bg-gray-50 transition active:scale-95">
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
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />
            <Suspense fallback={<div className="text-center p-10">Carregando ambiente de estudo...</div>}>
                <StudyContent />
            </Suspense>
        </div>
    );
}