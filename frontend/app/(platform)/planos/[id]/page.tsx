"use client";

import { useEffect, useState } from "react";
import { buscarPlanoPorId, gerarCardsParaTopico } from "@/app/actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { triggerHudRefresh } from "@/app/components/UserHUD";

type Topic = {
    id: string;
    title: string;
    _count: { cards: number };
};

type StudyPlan = {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    topics: Topic[];
};

export default function DetalhesPlanoPage({ params }: { params: Promise<{ id: string }> }) {
    const { isLoaded } = useUser();
    const [plano, setPlano] = useState<StudyPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [generatingTopicIds, setGeneratingTopicIds] = useState<string[]>([]);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [generationSuccess, setGenerationSuccess] = useState<string | null>(null);
    const [id, setId] = useState<string>("");

    useEffect(() => {
        params.then((resolved) => setId(resolved.id));
    }, [params]);

    useEffect(() => {
        if (!isLoaded || !id) return;
        void carregarPlano(true);
    }, [isLoaded, id]);

    async function carregarPlano(showLoading = false) {
        if (showLoading) setLoading(true);
        setLoadError(false);
        try {
            const dados = await buscarPlanoPorId(id);
            setPlano(dados as StudyPlan | null);
        } catch (error) {
            console.error("Erro ao carregar plano:", error);
            setLoadError(true);
        } finally {
            if (showLoading) setLoading(false);
        }
    }

    async function handleGerarConteudo(topicId: string, topicTitle: string) {
        if (generatingTopicIds.includes(topicId)) return;

        setGenerationError(null);
        setGenerationSuccess(null);
        setGeneratingTopicIds((current) => [...current, topicId]);
        try {
            const result = await gerarCardsParaTopico(plano!.title, topicId, topicTitle);
            if (!result.success) {
                setGenerationError(result.error || `Não foi possível gerar conteúdo para “${topicTitle}”. Tente novamente.`);
                return;
            }

            triggerHudRefresh();
            setGenerationSuccess(`Conteúdo de “${topicTitle}” criado e salvo.`);
            await carregarPlano();
        } catch (error) {
            console.error("Erro ao gerar conteúdo do tópico:", error);
            setGenerationError(`Não foi possível gerar conteúdo para “${topicTitle}”. Tente novamente.`);
        } finally {
            setGeneratingTopicIds((current) => current.filter((topic) => topic !== topicId));
        }
    }

    if (loading) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-4">
                <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 text-muted-foreground">
                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-hidden="true" />
                    <span className="text-sm font-medium">Carregando plano de estudos…</span>
                </div>
            </main>
        );
    }

    if (loadError) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-4">
                <section role="alert" className="w-full max-w-lg rounded-3xl border border-danger-border bg-danger-bg p-6 text-danger-fg">
                    <h1 className="text-xl font-extrabold">Não foi possível carregar este plano.</h1>
                    <p className="mt-2 text-sm leading-6">O plano não foi tratado como ausente. Tente consultar seus dados novamente.</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                        <button type="button" onClick={() => void carregarPlano(true)} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Tentar novamente</button>
                        <Link href="/colecao" className="rounded-xl border border-current/20 px-4 py-2.5 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voltar à biblioteca</Link>
                    </div>
                </section>
            </main>
        );
    }

    if (!plano) {
        return (
            <main className="flex min-h-screen items-center justify-center bg-background px-4">
                <section className="w-full max-w-lg rounded-3xl border border-border bg-card p-8 text-center shadow-sm">
                    <h1 className="text-xl font-extrabold text-card-foreground">Plano não encontrado</h1>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">Ele pode ter sido removido ou não pertencer à sua conta.</p>
                    <Link href="/colecao" className="mt-5 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Voltar à biblioteca</Link>
                </section>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-background px-4 pb-20 pt-6 transition-colors md:px-8 md:pt-10">
            <div className="mx-auto w-full max-w-4xl">
                <div className="mb-6">
                    <Link href="/colecao" className="text-sm font-bold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">← Voltar à biblioteca</Link>
                </div>

                <header className="mb-10 rounded-3xl border border-border bg-card p-6 text-center shadow-sm md:p-8">
                    <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary">{plano.difficulty}</span>
                    <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-card-foreground sm:text-4xl">{plano.title}</h1>
                    <p className="mx-auto mt-3 max-w-2xl text-base leading-7 text-muted-foreground">{plano.description}</p>
                    <p className="mt-4 text-sm font-medium text-muted-foreground">{plano.topics.length} {plano.topics.length === 1 ? "tópico" : "tópicos"} na trilha</p>
                </header>

                {generationError && (
                    <div role="alert" className="mb-6 flex items-start justify-between gap-4 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
                        <p>{generationError}</p>
                        <button type="button" onClick={() => setGenerationError(null)} className="font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fechar</button>
                    </div>
                )}
                {generationSuccess && (
                    <div role="status" aria-live="polite" className="mb-6 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">{generationSuccess}</div>
                )}

                <section aria-labelledby="plan-topics-title">
                    <div className="mb-5 flex items-end justify-between gap-4">
                        <div>
                            <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Trilha</p>
                            <h2 id="plan-topics-title" className="mt-1 text-2xl font-extrabold text-foreground">Tópicos do plano</h2>
                        </div>
                    </div>

                    <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:-translate-x-px before:bg-linear-to-b before:from-transparent before:via-border before:to-transparent md:before:mx-auto md:before:translate-x-0">
                        {plano.topics.map((topic, index) => {
                            const hasCards = topic._count.cards > 0;
                            const isGenerating = generatingTopicIds.includes(topic.id);

                            return (
                                <article key={topic.id} className="group relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse">
                                    <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-4 border-background bg-primary/20 shadow md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2" aria-hidden="true">
                                        <span className="text-sm font-bold text-primary">{index + 1}</span>
                                    </div>

                                    <div className="w-[calc(100%-4rem)] rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md md:w-[calc(50%-2.5rem)] md:p-6">
                                        <div className="flex items-start justify-between gap-3">
                                            <h3 className="text-lg font-bold text-card-foreground">{topic.title}</h3>
                                            {hasCards ? (
                                                <span className="shrink-0 rounded-md border border-success-border bg-success-bg px-2 py-1 text-xs font-bold text-success-fg">{topic._count.cards} cards</span>
                                            ) : (
                                                <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs text-muted-foreground">Pendente</span>
                                            )}
                                        </div>

                                        <div className="mt-5">
                                            {!hasCards ? (
                                                <button
                                                    type="button"
                                                    onClick={() => void handleGerarConteudo(topic.id, topic.title)}
                                                    disabled={isGenerating}
                                                    aria-busy={isGenerating}
                                                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary/10 px-4 text-sm font-bold text-primary transition hover:bg-primary/20 disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                                >
                                                    {isGenerating && <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-hidden="true" />}
                                                    {isGenerating ? "Criando conteúdo…" : "Gerar conteúdo"}
                                                </button>
                                            ) : (
                                                <Link href={`/estudar?topicId=${topic.id}`} className="inline-flex h-10 w-full items-center justify-center rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Revisar tópico</Link>
                                            )}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section>

                <div className="mt-12 flex justify-center">
                    <Link href={`/estudar?planId=${plano.id}`} className="inline-flex h-12 items-center justify-center rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Estudar plano completo</Link>
                </div>
            </div>
        </main>
    );
}
