"use client";

import { useEffect, useState } from "react";
import Flashcard from "@/app/components/Flashcard";
import { listarCardsDoBaralho, excluirFlashcard } from "@/app/actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function DetalhesBaralhoPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { isLoaded, isSignedIn } = useUser();
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deckId, setDeckId] = useState<string>("");

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
        if (!confirm("Excluir este cartão permanentemente?")) return;

        const result = await excluirFlashcard(id);
        if (result.success) {
            setCards((currentCards) => currentCards.filter((card) => card.id !== id));
            return;
        }

        alert(result.error || "Erro ao excluir.");
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-12 transition-colors duration-300">
            <div className="w-full max-w-5xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/colecao"
                        className="p-2 bg-card rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition shadow-sm border border-border"
                        aria-label="Voltar para a biblioteca"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Detalhes do Baralho</h1>
                        <p className="text-muted-foreground">{cards.length} cartões encontrados</p>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
                    </div>
                )}

                {!loading && cards.length === 0 && (
                    <div className="text-center py-20 bg-card rounded-3xl border border-border shadow-sm">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-foreground">Baralho Vazio</h3>
                        <p className="text-muted-foreground mb-6">Não há cartões aqui.</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                    {cards.map((card, index) => (
                        <Flashcard
                            key={card.id}
                            index={index}
                            frente={card.frente}
                            verso={card.verso}
                            onDelete={() => handleExcluirCard(card.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}