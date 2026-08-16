"use client";

import { useRef, useState } from "react";
import { FileText, LoaderCircle, Save, Sparkles, Text, X } from "lucide-react";
import Flashcard from "@/app/components/Flashcard";
import { useUser, SignInButton } from "@clerk/nextjs";
import SaveModal from "@/app/components/SaveModal";

type GeneratedFlashcard = { frente: string; verso: string };
type GenerateResponse = { cartoes?: GeneratedFlashcard[]; detail?: string };

export default function Home() {
    const { isSignedIn } = useUser();
    const [texto, setTexto] = useState("");
    const [arquivo, setArquivo] = useState<File | null>(null);
    const [flashcards, setFlashcards] = useState<GeneratedFlashcard[]>([]);
    const [loading, setLoading] = useState(false);
    const [erro, setErro] = useState("");
    const [saveSuccess, setSaveSuccess] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const saveButtonRef = useRef<HTMLButtonElement>(null);
    const [showModal, setShowModal] = useState(false);

    async function gerarFlashcards() {
        setErro("");
        setSaveSuccess(false);
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
                signal: controller.signal,
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({})) as GenerateResponse;
                const mensagemErro = errorData.detail || "Ocorreu um erro ao processar.";
                if (response.status === 504) throw new Error("O servidor demorou muito. Tente um arquivo menor.");
                if (response.status === 422) throw new Error(mensagemErro);
                throw new Error(mensagemErro);
            }

            const data = await response.json() as GenerateResponse;
            if (!Array.isArray(data.cartoes)) throw new Error("A geração retornou um formato inválido. Tente novamente.");
            setFlashcards(data.cartoes);
            if (arquivo) {
                setArquivo(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
            }
        } catch (error: unknown) {
            console.error(error);
            if (error instanceof Error && error.name === "AbortError") {
                setErro("Tempo esgotado. Tente um texto ou PDF menor.");
            } else {
                setErro(error instanceof Error ? error.message : "Ocorreu um erro inesperado durante a geração.");
            }
        } finally {
            setLoading(false);
        }
    }

    function closeSaveModalAndRestoreFocus() {
        setShowModal(false);
        requestAnimationFrame(() => saveButtonRef.current?.focus());
    }

    return (
        <main className="min-h-screen bg-background px-4 pb-16 pt-4 transition-colors md:px-6 md:pb-24">
            <div className="mx-auto w-full max-w-6xl">
                <header className="mb-8 max-w-3xl">
                    <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Criar material</p>
                    <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">Transforme sua fonte em flashcards revisáveis.</h1>
                    <p className="mt-3 text-base leading-7 text-muted-foreground md:text-lg">
                        Use texto ou PDF. A geração prepara uma primeira versão; revise os cards abaixo antes de escolher onde salvá-los.
                    </p>
                </header>

                <section aria-labelledby="source-heading" className="rounded-3xl border border-border bg-card p-5 shadow-sm md:p-7">
                    <div className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h2 id="source-heading" className="text-lg font-bold text-card-foreground">1. Adicione sua fonte</h2>
                            <p className="mt-1 text-sm text-muted-foreground">Escolha um único modo por geração: texto colado ou arquivo PDF.</p>
                        </div>
                        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">
                            {arquivo ? <FileText className="h-4 w-4" aria-hidden="true" /> : <Text className="h-4 w-4" aria-hidden="true" />}
                            {arquivo ? "PDF selecionado" : "Modo texto"}
                        </span>
                    </div>

                    <div className="mt-5">
                        {arquivo ? (
                            <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center" role="status" aria-live="polite">
                                <FileText className="mb-3 h-8 w-8 text-primary" aria-hidden="true" />
                                <p className="max-w-full truncate font-bold text-card-foreground">{arquivo.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">Este PDF será enviado para geração quando você confirmar abaixo.</p>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setArquivo(null);
                                        if (fileInputRef.current) fileInputRef.current.value = "";
                                    }}
                                    className="mt-4 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-destructive transition hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <X className="h-4 w-4" aria-hidden="true" />
                                    Remover PDF e usar texto
                                </button>
                            </div>
                        ) : (
                            <>
                                <label htmlFor="study-material" className="mb-2 block text-sm font-bold text-foreground">Conteúdo para gerar flashcards</label>
                                <textarea
                                    id="study-material"
                                    className="min-h-48 w-full resize-y rounded-2xl border border-input bg-background p-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-ring focus:ring-2 focus:ring-ring/20"
                                    placeholder="Cole seu texto de estudo aqui..."
                                    value={texto}
                                    onChange={(e) => setTexto(e.target.value)}
                                    disabled={loading}
                                />
                                <p className="mt-2 text-xs text-muted-foreground">Prefere um arquivo? Você pode trocar para PDF sem misturar as duas fontes.</p>
                            </>
                        )}
                    </div>

                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                        <div>
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
                                        setErro("");
                                        setSaveSuccess(false);
                                    }
                                }}
                            />
                            <label
                                htmlFor="file-upload"
                                className={`inline-flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-input bg-background px-5 text-sm font-bold text-foreground transition hover:bg-accent focus-within:outline-none focus-within:ring-2 focus-within:ring-ring sm:w-auto ${loading ? "pointer-events-none opacity-50" : ""}`}
                            >
                                <FileText className="h-4 w-4" aria-hidden="true" />
                                {arquivo ? "Trocar PDF" : "Usar PDF"}
                            </label>
                        </div>

                        <button
                            type="button"
                            onClick={gerarFlashcards}
                            disabled={loading}
                            aria-busy={loading}
                            className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            {loading ? <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" /> : <Sparkles className="h-5 w-5" aria-hidden="true" />}
                            {loading ? "Gerando Flashcards…" : arquivo ? "Gerar Flashcards do PDF" : "Gerar Flashcards"}
                        </button>
                    </div>
                    {loading && <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">A geração pode levar alguns instantes. Não feche esta página enquanto processamos a fonte.</p>}
                </section>

                {erro && (
                    <div role="alert" aria-live="assertive" className="mt-6 rounded-2xl border border-danger-border bg-danger-bg p-4 text-danger-fg shadow-sm">
                        <p className="font-bold">Não foi possível gerar os cards.</p>
                        <p className="mt-1 text-sm">{erro}</p>
                    </div>
                )}

                {saveSuccess && (
                    <div role="status" aria-live="polite" className="mt-6 rounded-2xl border border-success-border bg-success-bg p-4 text-success-fg">
                        <p className="font-bold">Flashcards salvos na sua coleção.</p>
                        <p className="mt-1 text-sm">Você pode continuar revisando esta geração ou abrir a coleção pelo menu principal.</p>
                    </div>
                )}

                {flashcards.length > 0 && (
                    <section aria-labelledby="review-heading" className="mt-10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-bold uppercase tracking-[0.18em] text-primary">Revisar resultado</p>
                                <h2 id="review-heading" className="mt-2 text-2xl font-extrabold text-foreground">2. Confira {flashcards.length} {flashcards.length === 1 ? "flashcard" : "flashcards"}</h2>
                                <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A IA pode produzir conteúdo incorreto ou incompleto. Confira frente e verso antes de persistir o material.</p>
                            </div>

                            {isSignedIn ? (
                                <button
                                    ref={saveButtonRef}
                                    type="button"
                                    onClick={() => {
                                        setSaveSuccess(false);
                                        setShowModal(true);
                                    }}
                                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-success-solid px-6 text-sm font-bold text-white shadow-sm transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <Save className="h-5 w-5" aria-hidden="true" />
                                    Salvar na minha Coleção
                                </button>
                            ) : (
                                <div className="rounded-2xl border border-border bg-card p-4 sm:max-w-sm">
                                    <p className="text-sm font-bold text-card-foreground">Entre para persistir esta geração.</p>
                                    <p className="mt-1 text-xs leading-5 text-muted-foreground">A geração atual ainda não faz parte da sua coleção.</p>
                                    <SignInButton mode="modal">
                                        <button type="button" className="mt-3 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Entrar ou criar conta</button>
                                    </SignInButton>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 grid grid-cols-1 gap-6 pb-8 md:grid-cols-2 lg:grid-cols-3">
                            {flashcards.map((card, index) => (
                                <Flashcard key={index} index={index} frente={card.frente} verso={card.verso} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {showModal && (
                <SaveModal
                    cards={flashcards}
                    onClose={closeSaveModalAndRestoreFocus}
                    onSuccess={() => {
                        setShowModal(false);
                        setSaveSuccess(true);
                        requestAnimationFrame(() => saveButtonRef.current?.focus());
                    }}
                />
            )}
        </main>
    );
}
