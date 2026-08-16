"use client";

import { useEffect, useState } from "react";
import Flashcard from "@/app/components/Flashcard";
import ConfirmDialog from "@/app/components/ConfirmDialog";
import { listarCardsDoBaralho, excluirFlashcard } from "@/app/actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

type DeckCard = Awaited<ReturnType<typeof listarCardsDoBaralho>>[number];

export default function DetalhesBaralhoPage({ params }: { params: Promise<{ deckId: string }> }) {
    const { isLoaded, isSignedIn } = useUser();
    const [cards, setCards] = useState<DeckCard[]>([]);
    const [loading, setLoading] = useState(true);
    const [deckId, setDeckId] = useState<string>("");
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

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

    const handleExcluirCard = async () => {
        if (!deleteTargetId || pendingDeleteId) return;

        const cardId = deleteTargetId;
        setMutationError(null);
        setPendingDeleteId(cardId);
        const result = await excluirFlashcard(cardId);
        setPendingDeleteId(null);

        if (result.success) {
            setCards((currentCards) => currentCards.filter((card) => card.id !== cardId));
            setDeleteTargetId(null);
            return;
        }

        setDeleteTargetId(null);
        setMutationError(`${result.error || "Erro ao excluir o cartão."} O cartão foi mantido; tente novamente.`);
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
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground">Detalhes do Baralho</h1>
                        <p className="text-muted-foreground">
                            {loading ? "Carregando cartões…" : `${cards.length} ${cards.length === 1 ? "cartão encontrado" : "cartões encontrados"}`}
                        </p>
                    </div>
                </div>

                {mutationError && (
                    <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        <p>{mutationError}</p>
                        <button type="button" onClick={() => setMutationError(null)} className="font-semibold underline underline-offset-2">
                            Fechar
                        </button>
                    </div>
                )}

                {loading && (
                    <div role="status" aria-live="polite" className="flex flex-col items-center justify-center gap-4 py-20 text-muted-foreground">
                        <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" aria-hidden="true"></div>
                        <span className="text-sm font-medium">Carregando cartões do baralho…</span>
                    </div>
                )}

                {!loading && cards.length === 0 && (
                    <div className="text-center py-20 bg-card rounded-3xl border border-border shadow-sm">
                        <div className="text-6xl mb-4" aria-hidden="true">📭</div>
                        <h2 className="text-xl font-bold text-foreground">Baralho vazio</h2>
                        <p className="text-muted-foreground mb-6">Este baralho ainda não tem cartões.</p>
                        <Link href="/dashboard" className="inline-flex h-11 items-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Criar flashcards
                        </Link>
                    </div>
                )}

                {!loading && cards.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
                        {cards.map((card, index) => (
                            <Flashcard
                                key={card.id}
                                index={index}
                                frente={card.frente}
                                verso={card.verso}
                                onDelete={() => setDeleteTargetId(card.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={deleteTargetId !== null}
                title="Excluir cartão?"
                description="Esta ação remove o cartão permanentemente deste baralho. Se a exclusão falhar, o cartão será mantido e você poderá tentar novamente."
                confirmLabel="Excluir cartão"
                pending={pendingDeleteId !== null}
                onCancel={() => {
                    if (!pendingDeleteId) setDeleteTargetId(null);
                }}
                onConfirm={handleExcluirCard}
            />
        </div>
    );
}
