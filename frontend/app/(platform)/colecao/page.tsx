"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BookOpenCheck, BrainCircuit, Library, LoaderCircle, Map, Plus, Trash2 } from "lucide-react";
import { criarBaralho, excluirBaralho, excluirPlano, listarMeusBaralhos, listarMeusPlanos } from "@/app/actions";
import ConfirmDialog from "@/app/components/ConfirmDialog";

type Deck = {
    id: string;
    nome: string;
    _count?: { cards: number };
};

type StudyPlan = {
    id: string;
    title: string;
    difficulty: string;
    topics?: unknown[];
};

type PendingDeletion =
    | { kind: "deck"; id: string; name: string }
    | { kind: "plan"; id: string; name: string }
    | null;

export default function ColecaoPage() {
    const [decks, setDecks] = useState<Deck[]>([]);
    const [planos, setPlanos] = useState<StudyPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);
    const [activeTab, setActiveTab] = useState<"DECKS" | "PLANOS">("DECKS");
    const [isCreating, setIsCreating] = useState(false);
    const [newDeckName, setNewDeckName] = useState("");
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [mutationSuccess, setMutationSuccess] = useState<string | null>(null);
    const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        void carregarDados();
    }, []);

    async function carregarDados() {
        setLoading(true);
        setLoadError(false);
        try {
            const [d, p] = await Promise.all([listarMeusBaralhos(), listarMeusPlanos()]);
            setDecks(d);
            setPlanos(p);
        } catch (error) {
            console.error("Erro ao carregar coleção:", error);
            setLoadError(true);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateDeck() {
        const name = newDeckName.trim();
        if (!name) {
            setMutationError("Informe um nome para o baralho.");
            return;
        }

        setMutationError(null);
        setMutationSuccess(null);
        setIsCreating(true);
        try {
            const result = await criarBaralho(name);
            if (!result.success) {
                setMutationError(result.error || "Erro ao criar baralho.");
                return;
            }

            setNewDeckName("");
            setMutationSuccess(`Baralho “${name}” criado.`);
            await carregarDados();
        } finally {
            setIsCreating(false);
        }
    }

    async function confirmDeletion() {
        if (!pendingDeletion) return;

        setMutationError(null);
        setMutationSuccess(null);
        setIsDeleting(true);
        try {
            const result = pendingDeletion.kind === "deck"
                ? await excluirBaralho(pendingDeletion.id)
                : await excluirPlano(pendingDeletion.id);

            if (!result.success) {
                setMutationError(result.error || `Não foi possível excluir ${pendingDeletion.kind === "deck" ? "o baralho" : "o plano"}.`);
                return;
            }

            setMutationSuccess(`${pendingDeletion.kind === "deck" ? "Baralho" : "Plano"} “${pendingDeletion.name}” excluído.`);
            setPendingDeletion(null);
            await carregarDados();
        } finally {
            setIsDeleting(false);
        }
    }

    const deletionTitle = pendingDeletion?.kind === "deck" ? "Excluir baralho?" : "Excluir plano de estudo?";
    const deletionDescription = pendingDeletion?.kind === "deck"
        ? `“${pendingDeletion?.name ?? "Este baralho"}” e todos os cards associados serão excluídos. Esta ação não pode ser desfeita.`
        : `“${pendingDeletion?.name ?? "Este plano"}” e sua estrutura de estudo serão excluídos. Esta ação não pode ser desfeita.`;

    return (
        <main className="min-h-screen bg-background px-4 pb-20 pt-4 transition-colors md:px-6">
            <div className="mx-auto w-full max-w-6xl">
                <header className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Biblioteca</p>
                        <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Seus materiais em um só lugar.</h1>
                        <p className="mt-3 text-base leading-7 text-muted-foreground">Abra um baralho para editar ou estudar, ou acompanhe as trilhas geradas para um objetivo específico.</p>
                    </div>

                    {activeTab === "DECKS" ? (
                        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto">
                            <label htmlFor="new-deck-name" className="sr-only">Nome do novo baralho</label>
                            <input
                                id="new-deck-name"
                                type="text"
                                placeholder="Nome do novo baralho"
                                className="h-11 w-full rounded-xl border border-input bg-background px-4 text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20 sm:w-64"
                                value={newDeckName}
                                onChange={(event) => {
                                    setNewDeckName(event.target.value);
                                    setMutationError(null);
                                    setMutationSuccess(null);
                                }}
                                onKeyDown={(event) => {
                                    if (event.key === "Enter") void handleCreateDeck();
                                }}
                                disabled={isCreating}
                            />
                            <button
                                type="button"
                                aria-label="Criar"
                                onClick={() => void handleCreateDeck()}
                                disabled={isCreating || !newDeckName.trim()}
                                aria-busy={isCreating}
                                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                                {isCreating ? "Criando…" : "Novo baralho"}
                            </button>
                        </div>
                    ) : (
                        <Link href="/planos/novo" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:w-auto">
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Novo plano
                        </Link>
                    )}
                </header>

                {mutationError && (
                    <div role="alert" className="mb-5 flex items-start justify-between gap-4 rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-fg">
                        <p>{mutationError}</p>
                        <button type="button" onClick={() => setMutationError(null)} className="font-bold underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Fechar</button>
                    </div>
                )}
                {mutationSuccess && (
                    <div role="status" aria-live="polite" className="mb-5 rounded-2xl border border-success-border bg-success-bg px-4 py-3 text-sm font-medium text-success-fg">{mutationSuccess}</div>
                )}

                <section className="mb-8 rounded-3xl border border-border bg-card p-5 shadow-sm md:p-6" aria-labelledby="exam-shortcut-title">
                    <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
                        <div className="flex gap-4">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span>
                            <div>
                                <h2 id="exam-shortcut-title" className="text-lg font-bold text-card-foreground">Praticar com simulado</h2>
                                <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">Escolha uma fonte, dificuldade e duração. Pontuação e XP são calculados pelo servidor a partir da tentativa registrada.</p>
                            </div>
                        </div>
                        <Link href="/simulado" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            Configurar simulado
                        </Link>
                    </div>
                </section>

                <div className="mb-6 flex gap-2 rounded-2xl bg-muted p-1.5" role="tablist" aria-label="Conteúdo da biblioteca">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "DECKS"}
                        aria-controls="library-decks"
                        onClick={() => setActiveTab("DECKS")}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "DECKS" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Library className="h-4 w-4" aria-hidden="true" />
                        Baralhos
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "PLANOS"}
                        aria-controls="library-plans"
                        onClick={() => setActiveTab("PLANOS")}
                        className={`inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${activeTab === "PLANOS" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                        <Map className="h-4 w-4" aria-hidden="true" />
                        Planos
                    </button>
                </div>

                {loading ? (
                    <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        <span className="sr-only">Carregando biblioteca</span>
                        {[0, 1, 2].map((item) => <div key={item} className="h-48 animate-pulse rounded-2xl border border-border bg-muted/70" aria-hidden="true" />)}
                    </div>
                ) : loadError ? (
                    <section role="alert" className="rounded-3xl border border-danger-border bg-danger-bg p-6 text-danger-fg">
                        <h2 className="text-lg font-extrabold">Não foi possível carregar sua biblioteca.</h2>
                        <p className="mt-2 text-sm leading-6">Nenhum material foi tratado como ausente. Tente consultar seus dados novamente.</p>
                        <button type="button" onClick={() => void carregarDados()} className="mt-4 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Tentar novamente</button>
                    </section>
                ) : activeTab === "DECKS" ? (
                    <section id="library-decks" role="tabpanel" aria-label="Baralhos">
                        {decks.length > 0 ? (
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                                {decks.map((deck) => (
                                    <article key={deck.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                                        <div className="flex items-start justify-between gap-4">
                                            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Library className="h-5 w-5" aria-hidden="true" /></span>
                                            <button
                                                type="button"
                                                onClick={() => setPendingDeletion({ kind: "deck", id: deck.id, name: deck.nome })}
                                                aria-label={`Excluir baralho ${deck.nome}`}
                                                className="rounded-lg p-2 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                            ><Trash2 className="h-4 w-4" aria-hidden="true" /></button>
                                        </div>
                                        <h2 className="mt-5 truncate text-xl font-bold text-card-foreground">{deck.nome}</h2>
                                        <p className="mt-1 text-sm text-muted-foreground">{deck._count?.cards || 0} flashcards</p>
                                        <div className="mt-6 grid grid-cols-2 gap-2">
                                            <Link href={`/colecao/${deck.id}`} className="inline-flex h-10 items-center justify-center rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Editar</Link>
                                            <Link href={`/estudar?deckId=${deck.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><BookOpenCheck className="h-4 w-4" aria-hidden="true" />Estudar</Link>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
                                <Library className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                                <h2 className="mt-4 text-lg font-bold text-card-foreground">Nenhum baralho ainda</h2>
                                <p className="mt-2 text-sm text-muted-foreground">Crie um baralho acima ou gere flashcards para começar sua coleção.</p>
                                <Link href="/dashboard" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Criar flashcards</Link>
                            </div>
                        )}
                    </section>
                ) : (
                    <section id="library-plans" role="tabpanel" aria-label="Planos de estudo">
                        {planos.length > 0 ? (
                            <div className="grid gap-4">
                                {planos.map((plano) => (
                                    <article key={plano.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                                        <Link href={`/planos/${plano.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-info-bg text-info-fg"><Map className="h-5 w-5" aria-hidden="true" /></span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-lg font-bold text-card-foreground">{plano.title}</span>
                                                <span className="mt-1 block text-sm text-muted-foreground">{plano.difficulty} · {plano.topics?.length || 0} módulos</span>
                                            </span>
                                        </Link>
                                        <button
                                            type="button"
                                            onClick={() => setPendingDeletion({ kind: "plan", id: plano.id, name: plano.title })}
                                            aria-label={`Excluir plano ${plano.title}`}
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold text-muted-foreground transition hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                        ><Trash2 className="h-4 w-4" aria-hidden="true" />Excluir</button>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-3xl border border-dashed border-border bg-card px-6 py-14 text-center">
                                <Map className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
                                <h2 className="mt-4 text-lg font-bold text-card-foreground">Nenhum plano de estudo</h2>
                                <p className="mt-2 text-sm text-muted-foreground">Gere um roteiro e revise os tópicos antes de estudar.</p>
                                <Link href="/planos/novo" className="mt-5 inline-flex h-10 items-center justify-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Criar plano</Link>
                            </div>
                        )}
                    </section>
                )}
            </div>

            <ConfirmDialog
                open={pendingDeletion !== null}
                title={deletionTitle}
                description={deletionDescription}
                pending={isDeleting}
                onCancel={() => setPendingDeletion(null)}
                onConfirm={() => void confirmDeletion()}
            />
        </main>
    );
}
