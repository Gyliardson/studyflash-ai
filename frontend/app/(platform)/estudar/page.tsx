"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Flashcard from "@/app/components/Flashcard";
import { contarTotalFlashcards } from "@/app/actions";
import { iniciarOuRetomarSessaoEstudo, registrarRevisaoDaSessao } from "@/app/study-actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

type ReviewEvaluation = "errei" | "dificil" | "facil";
type StudyCard = { id: string; frente: string; verso: string };
type SubmissionState = "idle" | "submitting" | "failed";

function StudyContent() {
    const { isLoaded, isSignedIn } = useUser();
    const searchParams = useSearchParams();
    const submitLock = useRef(false);

    const [queue, setQueue] = useState<StudyCard[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [cardAtualIndex, setCardAtualIndex] = useState(0);
    const [finalizou, setFinalizou] = useState(false);
    const [totalCards, setTotalCards] = useState(0);
    const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
    const [pendingEvaluation, setPendingEvaluation] = useState<ReviewEvaluation | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const deckIdsParam = searchParams.get("decks");
    const singleDeckId = searchParams.get("deckId");
    const deckIds = deckIdsParam ? deckIdsParam.split(",") : (singleDeckId ? [singleDeckId] : []);
    const planId = searchParams.get("planId") || undefined;
    const topicId = searchParams.get("topicId") || undefined;

    useEffect(() => {
        let cancelled = false;

        async function carregar() {
            if (!isLoaded || !isSignedIn) {
                if (!cancelled) setLoading(false);
                return;
            }

            setLoading(true);
            setReviewError(null);
            try {
                const [session, total] = await Promise.all([
                    iniciarOuRetomarSessaoEstudo({ deckIds, planId, topicId }),
                    contarTotalFlashcards(deckIds, planId, topicId),
                ]);
                if (cancelled) return;
                setTotalCards(total);
                if (!session.success) {
                    setQueue([]);
                    setSessionId(null);
                    setReviewError(session.error || "Não foi possível carregar sua sessão de estudo.");
                    return;
                }
                setQueue(session.cards);
                setSessionId(session.sessionId ?? null);
                setCardAtualIndex(0);
                setFinalizou(session.cards.length === 0 && total > 0);
            } catch (error) {
                console.error("Erro ao carregar sessão de estudo:", error);
                if (!cancelled) setReviewError("Não foi possível carregar sua sessão de estudo. Recarregue a página para tentar novamente.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        carregar();
        return () => { cancelled = true; };
    }, [isLoaded, isSignedIn, deckIdsParam, singleDeckId, planId, topicId]);

    const submitReview = async (avaliacao: ReviewEvaluation) => {
        if (submitLock.current || submissionState === "submitting") return;
        const cardAtual = queue[cardAtualIndex];
        if (!cardAtual || !sessionId) {
            setSubmissionState("failed");
            setPendingEvaluation(avaliacao);
            setReviewError("A sessão não está disponível. Recarregue a página para retomar com segurança.");
            return;
        }

        submitLock.current = true;
        setSubmissionState("submitting");
        setPendingEvaluation(avaliacao);
        setReviewError(null);

        try {
            const result = await registrarRevisaoDaSessao(sessionId, cardAtual.id, avaliacao);
            if (!result.success) {
                setSubmissionState("failed");
                setReviewError(result.error || "Não foi possível salvar sua revisão. Tente novamente.");
                return;
            }

            const nextIndex = cardAtualIndex + 1;
            setSubmissionState("idle");
            setPendingEvaluation(null);
            if (nextIndex < queue.length) {
                setCardAtualIndex(nextIndex);
            } else {
                setFinalizou(true);
            }
        } catch (error) {
            console.error("Erro ao confirmar revisão:", error);
            setSubmissionState("failed");
            setReviewError("A confirmação falhou. Tente novamente; retries do mesmo cartão não duplicam XP.");
        } finally {
            submitLock.current = false;
        }
    };

    const handleEstudarMais = async () => {
        if (submitLock.current) return;
        setLoading(true);
        setReviewError(null);
        setSubmissionState("idle");
        setPendingEvaluation(null);
        try {
            const session = await iniciarOuRetomarSessaoEstudo({ deckIds, planId, topicId, modeExtra: true });
            if (!session.success) {
                setReviewError(session.error || "Não foi possível iniciar a sessão extra.");
                return;
            }
            if (session.cards.length > 0 && session.sessionId) {
                setQueue(session.cards);
                setSessionId(session.sessionId);
                setCardAtualIndex(0);
                setFinalizou(false);
            } else {
                setReviewError("Não há mais cards disponíveis nesta seleção.");
            }
        } catch (error) {
            console.error("Erro ao carregar estudo extra:", error);
            setReviewError("Não foi possível iniciar a sessão extra.");
        } finally {
            setLoading(false);
        }
    };

    const getSessionTitle = () => {
        if (topicId) return "Revisão de Tópico";
        if (planId) return "Estudo do Plano Completo";
        if (deckIds.length > 0) return `${deckIds.length} Baralho(s) Selecionado(s)`;
        return "Modo Global (Tudo)";
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20" role="status" aria-label="Carregando sessão de estudo">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    return (
        <div className="w-full max-w-2xl text-center px-4">
            <div className="mb-6">
                <span className="text-xs font-bold text-primary tracking-widest uppercase mb-1 block">{getSessionTitle()}</span>
            </div>

            {reviewError && (
                <div role="alert" className="mb-5 rounded-xl border border-danger-border bg-danger-bg p-4 text-left text-sm text-danger-fg">
                    <p className="font-semibold">Sua revisão ainda não foi confirmada.</p>
                    <p className="mt-1">{reviewError}</p>
                    {submissionState === "failed" && pendingEvaluation && sessionId && queue[cardAtualIndex] && (
                        <button
                            type="button"
                            onClick={() => submitReview(pendingEvaluation)}
                            className="mt-3 rounded-lg border border-danger-border bg-card px-4 py-2 font-bold text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            Tentar novamente
                        </button>
                    )}
                </div>
            )}

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

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-busy={submissionState === "submitting"}>
                        <button
                            type="button"
                            disabled={submissionState === "submitting"}
                            onClick={() => submitReview("errei")}
                            className="py-4 bg-danger-bg text-danger-fg font-bold rounded-xl hover:opacity-80 transition-opacity border border-danger-border active:scale-95 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            Errei 😓
                        </button>
                        <button
                            type="button"
                            disabled={submissionState === "submitting"}
                            onClick={() => submitReview("dificil")}
                            className="py-4 bg-warning-bg text-warning-fg font-bold rounded-xl hover:opacity-80 transition-opacity border border-warning-border active:scale-95 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            Difícil 😐
                        </button>
                        <button
                            type="button"
                            disabled={submissionState === "submitting"}
                            onClick={() => submitReview("facil")}
                            className="py-4 bg-success-bg text-success-fg font-bold rounded-xl hover:opacity-80 transition-opacity border border-success-border active:scale-95 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        >
                            Fácil 🤩
                        </button>
                    </div>
                    {submissionState === "submitting" && (
                        <p role="status" className="mt-3 text-sm font-medium text-muted-foreground">Salvando sua revisão antes de avançar…</p>
                    )}
                </>
            ) : (
                <div className="bg-card p-10 rounded-3xl shadow-xl border border-border text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {totalCards === 0 ? (
                        <>
                            <div className="text-6xl mb-4" aria-hidden="true">📭</div>
                            <h2 className="text-2xl font-bold text-card-foreground mb-2">Nada por aqui</h2>
                            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                                Não há cartões para estudar nesta seleção. Que tal criar novos conteúdos?
                            </p>
                            <Link href={planId ? `/planos/${planId}` : "/colecao"} className="block w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                {planId ? "Voltar ao Plano" : "Voltar para Coleção"}
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="text-6xl mb-4 animate-bounce" aria-hidden="true">🎉</div>
                            <h2 className="text-2xl font-bold text-card-foreground mb-2">Sessão Finalizada!</h2>
                            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                                Todas as revisões confirmadas foram salvas.
                                <br />
                                <span className="text-sm text-foreground">Total nesta seleção: {totalCards} cartas.</span>
                            </p>

                            <div className="flex flex-col gap-3 max-w-xs mx-auto">
                                <button
                                    type="button"
                                    onClick={handleEstudarMais}
                                    className="w-full bg-primary text-primary-foreground px-6 py-3.5 rounded-xl font-bold hover:bg-primary/90 transition shadow-lg shadow-primary/20 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                                >
                                    🚀 Estudar Mais (+20)
                                </button>
                                <Link href={planId ? `/planos/${planId}` : "/colecao"} className="w-full bg-card text-foreground border border-border px-6 py-3.5 rounded-xl font-bold hover:bg-muted transition active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                                    {planId ? "Voltar ao Roteiro" : "Voltar para Coleção"}
                                </Link>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

export default function EstudarPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-12 transition-colors duration-300">
            <Suspense fallback={<div className="text-center p-10 text-muted-foreground">Carregando ambiente de estudo...</div>}>
                <StudyContent />
            </Suspense>
        </div>
    );
}
