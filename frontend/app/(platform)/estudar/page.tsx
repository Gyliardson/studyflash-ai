"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Flashcard from "@/app/components/Flashcard";
import { contarTotalFlashcards } from "@/app/actions";
import { iniciarOuRetomarSessaoEstudo, registrarRevisaoDaSessao } from "@/app/study-actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, Gauge, LoaderCircle, RefreshCw, RotateCcw, Sparkles } from "lucide-react";

type ReviewEvaluation = "errei" | "dificil" | "facil";
type StudyCard = { id: string; frente: string; verso: string };
type SubmissionState = "idle" | "submitting" | "failed";

const REVIEW_CHOICES: Array<{
    id: ReviewEvaluation;
    title: string;
    description: string;
    icon: typeof RotateCcw;
    className: string;
}> = [
    {
        id: "errei",
        title: "Errei",
        description: "Recomeçar o intervalo",
        icon: RotateCcw,
        className: "border-danger-border bg-danger-bg text-danger-fg hover:brightness-95",
    },
    {
        id: "dificil",
        title: "Difícil",
        description: "Rever mais cedo",
        icon: Gauge,
        className: "border-warning-border bg-warning-bg text-warning-fg hover:brightness-95",
    },
    {
        id: "facil",
        title: "Fácil",
        description: "Aumentar o intervalo",
        icon: Sparkles,
        className: "border-success-border bg-success-bg text-success-fg hover:brightness-95",
    },
];

function StudyContent() {
    const { isLoaded, isSignedIn } = useUser();
    const searchParams = useSearchParams();
    const submitLock = useRef(false);

    const [queue, setQueue] = useState<StudyCard[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [reloadKey, setReloadKey] = useState(0);
    const [cardAtualIndex, setCardAtualIndex] = useState(0);
    const [finalizou, setFinalizou] = useState(false);
    const [totalCards, setTotalCards] = useState(0);
    const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
    const [pendingEvaluation, setPendingEvaluation] = useState<ReviewEvaluation | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [reviewError, setReviewError] = useState<string | null>(null);

    const deckIdsParam = searchParams.get("decks");
    const singleDeckId = searchParams.get("deckId");
    const deckIds = useMemo(
        () => deckIdsParam ? deckIdsParam.split(",") : (singleDeckId ? [singleDeckId] : []),
        [deckIdsParam, singleDeckId],
    );
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
            setLoadError(null);
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
                    setLoadError(session.error || "Não foi possível carregar sua sessão de estudo.");
                    return;
                }

                setQueue(session.cards);
                setSessionId(session.sessionId ?? null);
                setCardAtualIndex(0);
                setFinalizou(session.cards.length === 0 && total > 0);
            } catch (error) {
                console.error("Erro ao carregar sessão de estudo:", error);
                if (!cancelled) {
                    setQueue([]);
                    setSessionId(null);
                    setLoadError("Não foi possível carregar sua sessão de estudo. Confira sua conexão e tente novamente.");
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        }

        void carregar();
        return () => { cancelled = true; };
    }, [isLoaded, isSignedIn, deckIds, planId, topicId, reloadKey]);

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
            setReviewError("A confirmação falhou. Tente novamente; a mesma revisão pode ser reenviada sem duplicar XP.");
        } finally {
            submitLock.current = false;
        }
    };

    const handleEstudarMais = async () => {
        if (submitLock.current) return;
        setLoading(true);
        setLoadError(null);
        setReviewError(null);
        setSubmissionState("idle");
        setPendingEvaluation(null);
        try {
            const session = await iniciarOuRetomarSessaoEstudo({ deckIds, planId, topicId, modeExtra: true });
            if (!session.success) {
                setLoadError(session.error || "Não foi possível iniciar a sessão extra.");
                return;
            }
            if (session.cards.length > 0 && session.sessionId) {
                setQueue(session.cards);
                setSessionId(session.sessionId);
                setCardAtualIndex(0);
                setFinalizou(false);
            } else {
                setLoadError("Não há mais cards disponíveis nesta seleção.");
            }
        } catch (error) {
            console.error("Erro ao carregar estudo extra:", error);
            setLoadError("Não foi possível iniciar a sessão extra. Confira sua conexão e tente novamente.");
        } finally {
            setLoading(false);
        }
    };

    const getSessionTitle = () => {
        if (topicId) return "Revisão de tópico";
        if (planId) return "Plano completo";
        if (deckIds.length === 1) return "Baralho selecionado";
        if (deckIds.length > 1) return `${deckIds.length} baralhos selecionados`;
        return "Revisão global";
    };

    const backHref = planId ? `/planos/${planId}` : "/colecao";
    const progress = queue.length > 0 ? Math.round(((cardAtualIndex + 1) / queue.length) * 100) : 0;

    if (loading) {
        return (
            <div className="mx-auto w-full max-w-2xl px-4 py-16" role="status" aria-live="polite">
                <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
                    <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                    <p className="mt-4 font-bold text-foreground">Preparando sua sessão</p>
                    <p className="mt-1 text-sm text-muted-foreground">Buscando apenas revisões confirmadas pelo servidor.</p>
                </div>
            </div>
        );
    }

    if (loadError) {
        return (
            <section className="mx-auto w-full max-w-xl px-4 py-12" aria-labelledby="study-load-error-title">
                <div className="rounded-3xl border border-danger-border bg-card p-7 text-left shadow-sm">
                    <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-danger-fg">Sessão indisponível</p>
                    <h1 id="study-load-error-title" className="mt-2 text-2xl font-black tracking-tight text-foreground">Não foi possível preparar o estudo</h1>
                    <p role="alert" className="mt-3 text-sm leading-6 text-muted-foreground">{loadError}</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button
                            type="button"
                            onClick={() => setReloadKey((value) => value + 1)}
                            className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            Tentar novamente
                        </button>
                        <Link href={backHref} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                            Voltar
                        </Link>
                    </div>
                </div>
            </section>
        );
    }

    return (
        <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-12">
            {!finalizou && queue.length > 0 ? (
                <>
                    <header className="mb-6">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-primary">{getSessionTitle()}</p>
                                <h1 className="mt-2 text-3xl font-black tracking-tight text-foreground">Sessão de estudo</h1>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                                    Revele o verso, avalie a lembrança e aguarde a confirmação antes de avançar. Sua fila pode ser retomada após uma interrupção.
                                </p>
                            </div>
                            <div className="shrink-0 rounded-2xl border border-border bg-card px-4 py-3 text-right shadow-sm">
                                <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Progresso</span>
                                <span className="mt-1 block text-lg font-black tabular-nums text-foreground" aria-live="polite">{cardAtualIndex + 1} / {queue.length}</span>
                            </div>
                        </div>
                        <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </header>

                    {reviewError && (
                        <div role="alert" className="mb-5 rounded-2xl border border-danger-border bg-danger-bg p-4 text-left text-sm text-danger-fg">
                            <p className="font-bold">A revisão ainda não foi confirmada.</p>
                            <p className="mt-1 leading-6">{reviewError}</p>
                            {submissionState === "failed" && pendingEvaluation && sessionId && queue[cardAtualIndex] && (
                                <button
                                    type="button"
                                    onClick={() => void submitReview(pendingEvaluation)}
                                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-danger-border bg-card px-4 py-2 font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                                    Reenviar esta avaliação
                                </button>
                            )}
                        </div>
                    )}

                    <div className="mb-6">
                        <Flashcard
                            key={queue[cardAtualIndex].id}
                            index={cardAtualIndex}
                            frente={queue[cardAtualIndex].frente}
                            verso={queue[cardAtualIndex].verso}
                        />
                    </div>

                    <fieldset className="rounded-3xl border border-border bg-card p-4 shadow-sm md:p-5" aria-busy={submissionState === "submitting"}>
                        <legend className="px-2 text-xs font-extrabold uppercase tracking-[0.16em] text-muted-foreground">Como foi lembrar?</legend>
                        <div className="grid gap-3 sm:grid-cols-3">
                            {REVIEW_CHOICES.map(({ id, title, description, icon: Icon, className }) => (
                                <button
                                    key={id}
                                    type="button"
                                    disabled={submissionState === "submitting"}
                                    onClick={() => void submitReview(id)}
                                    className={`min-h-24 rounded-2xl border p-4 text-left transition active:scale-[0.99] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
                                >
                                    <Icon className="h-5 w-5" aria-hidden="true" />
                                    <span className="mt-3 block font-black">{title}</span>
                                    <span className="mt-1 block text-xs font-medium opacity-80">{description}</span>
                                </button>
                            ))}
                        </div>
                        {submissionState === "submitting" && (
                            <p role="status" className="mt-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
                                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                                Salvando sua revisão antes de avançar…
                            </p>
                        )}
                    </fieldset>
                </>
            ) : (
                <section className="rounded-3xl border border-border bg-card p-7 text-center shadow-sm md:p-10" aria-labelledby="study-state-title">
                    {totalCards === 0 ? (
                        <>
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground" aria-hidden="true">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-muted-foreground">Sem cards nesta seleção</p>
                            <h1 id="study-state-title" className="mt-2 text-2xl font-black tracking-tight text-foreground">Nada para revisar agora</h1>
                            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                                Esta seleção ainda não possui cards disponíveis. Volte para sua coleção ou plano para preparar conteúdo de estudo.
                            </p>
                            <Link href={backHref} className="mx-auto mt-6 inline-flex min-h-11 w-full max-w-xs items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                {planId ? "Voltar ao plano" : "Voltar à coleção"}
                            </Link>
                        </>
                    ) : (
                        <>
                            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-success-bg text-success-fg" aria-hidden="true">
                                <CheckCircle2 className="h-6 w-6" />
                            </div>
                            <p className="mt-5 text-xs font-extrabold uppercase tracking-[0.18em] text-success-fg">Sessão confirmada</p>
                            <h1 id="study-state-title" className="mt-2 text-2xl font-black tracking-tight text-foreground">Revisão concluída</h1>
                            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                                Todas as avaliações desta fila foram confirmadas pelo servidor. Esta seleção possui {totalCards} {totalCards === 1 ? "card" : "cards"} no total.
                            </p>
                            <div className="mx-auto mt-7 flex max-w-sm flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={() => void handleEstudarMais()}
                                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                                    Estudar mais cards
                                </button>
                                <Link href={backHref} className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 font-bold text-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                                    Voltar
                                </Link>
                            </div>
                        </>
                    )}
                </section>
            )}
        </div>
    );
}

export default function EstudarPage() {
    return (
        <div className="min-h-[calc(100vh-8rem)] bg-background">
            <Suspense fallback={
                <div className="mx-auto w-full max-w-2xl px-4 py-16" role="status">
                    <div className="rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
                        <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                        <p className="mt-4 font-bold text-foreground">Carregando ambiente de estudo…</p>
                    </div>
                </div>
            }>
                <StudyContent />
            </Suspense>
        </div>
    );
}
