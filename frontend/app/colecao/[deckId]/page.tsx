"use client";

import { useEffect, useState, use } from "react";
import Header from "../../components/Header";
import Flashcard from "../../components/Flashcard";
import { listarCardsDoBaralho, excluirFlashcard } from "../../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

// Em Next.js 15+, params é uma Promise
export default function DetalhesBaralhoPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { isLoaded, isSignedIn } = useUser();
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deckId, setDeckId] = useState<string>("");

    // Desembrulha os params (Next.js 15 pattern)
    useEffect(() => {
        params.then((resolvedParams) => {
            setDeckId(resolvedParams.deckId);
        });
    }, [params]);

    useEffect(() => {
        async function carregar() {
            if (!isLoaded || !deckId) return;
            if (!isSignedIn) {
                setLoading(false);
                return;
            }

            const dados = await listarCardsDoBaralho(deckId);
            setCards(dados);
            setLoading(false);
        }

        carregar();
    }, [isLoaded, isSignedIn, deckId]);

    const handleExcluirCard = async (id: string) => {
        if (confirm("Excluir este cartão permanentemente?")) {
            const sucesso = await excluirFlashcard(id);
            if (sucesso) {
                setCards(cards.filter(c => c.id !== id));
            } else {
                alert("Erro ao excluir.");
            }
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-5xl">
                {/* Cabeçalho com Voltar */}
                <div className="flex items-center gap-4 mb-8">
                    <Link href="/colecao">
                        <button className="p-2 bg-white rounded-full hover:bg-gray-100 text-gray-500 transition shadow-sm">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        </button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Detalhes do Baralho</h1>
                        <p className="text-gray-500">{cards.length} cartões encontrados</p>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {!loading && cards.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-gray-800">Baralho Vazio</h3>
                        <p className="text-gray-500 mb-6">Não há cartões aqui.</p>
                    </div>
                )}

                {/* GRID DE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card, index) => (
                        <Flashcard
                            key={card.id}
                            index={index}
                            frente={card.frente}
                            verso={card.verso}
                            onDelete={() => handleExcluirCard(card.id)} // Passamos a função aqui!
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}