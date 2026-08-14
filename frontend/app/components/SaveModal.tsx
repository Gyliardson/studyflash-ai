"use client";

import { useEffect, useRef, useState } from "react";
import { listarMeusBaralhos, salvarFlashcards } from "../actions";
import { triggerHudRefresh } from "./UserHUD";

interface SaveModalProps {
    cards: { frente: string; verso: string }[];
    onClose: () => void;
    onSuccess: () => void;
}

type DeckOption = {
    id: string;
    nome: string;
    _count: { cards: number };
};

export default function SaveModal({ cards, onClose, onSuccess }: SaveModalProps) {
    const [decks, setDecks] = useState<DeckOption[]>([]);
    const [selectedDeck, setSelectedDeck] = useState("");
    const [newDeckName, setNewDeckName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const dialogRef = useRef<HTMLDivElement>(null);
    const closeButtonRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        listarMeusBaralhos().then((data) => {
            setDecks(data);
            if (data.length > 0) setSelectedDeck(data[0].id);
            setLoading(false);
        });
        closeButtonRef.current?.focus();
    }, []);

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape" && !saving) {
                event.preventDefault();
                onClose();
                return;
            }
            if (event.key !== "Tab" || !dialogRef.current) return;
            const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
                'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
            ));
            if (focusable.length === 0) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        }
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [onClose, saving]);

    function completeSuccessfulSave() {
        setMutationError(null);
        triggerHudRefresh();
        onSuccess();
    }

    async function handleCreateAndSave() {
        const name = newDeckName.trim();
        if (!name) {
            setMutationError("Digite um nome para o grupo.");
            return;
        }

        setMutationError(null);
        setSaving(true);
        try {
            const result = await salvarFlashcards(cards, undefined, name);
            if (!result.success) {
                setMutationError(result.error || "Falha ao criar o grupo e salvar os flashcards. Nenhuma alteração foi mantida.");
                return;
            }

            completeSuccessfulSave();
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveExisting() {
        if (!selectedDeck) {
            setMutationError("Selecione um grupo.");
            return;
        }

        setMutationError(null);
        setSaving(true);
        try {
            const result = await salvarFlashcards(cards, selectedDeck);
            if (!result.success) {
                setMutationError(result.error || "Falha ao salvar os flashcards. Tente novamente.");
                return;
            }

            completeSuccessfulSave();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100 p-4">
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="save-modal-title"
                aria-describedby="save-modal-description"
                className="bg-popover rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 border border-border"
            >
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h2 id="save-modal-title" className="text-xl font-bold text-popover-foreground">Onde vamos guardar? 🗂️</h2>
                        <p id="save-modal-description" className="sr-only">Escolha um grupo existente ou crie um novo grupo para salvar os flashcards.</p>
                    </div>
                    <button ref={closeButtonRef} type="button" onClick={onClose} disabled={saving} aria-label="Fechar diálogo" className="text-muted-foreground hover:text-foreground transition disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {mutationError && (
                    <div role="alert" aria-live="assertive" className="mb-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {mutationError}
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center py-8 text-muted-foreground" role="status" aria-live="polite">
                        <div className="animate-spin h-6 w-6 border-2 border-primary border-t-transparent rounded-full mb-2" aria-hidden="true"></div>
                        <p className="text-sm">Buscando seus grupos...</p>
                    </div>
                )}

                {!loading && (
                    <div className="space-y-5">
                        {decks.length > 0 && !creating && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <label htmlFor="save-modal-deck" className="block text-sm font-bold text-muted-foreground mb-2">Escolha um grupo existente:</label>
                                <div className="relative">
                                    <select
                                        id="save-modal-deck"
                                        className="w-full p-3 pl-4 pr-10 border border-border rounded-xl bg-card text-card-foreground font-medium focus:border-ring focus:ring-4 focus:ring-ring/20 outline-none appearance-none transition-all cursor-pointer hover:border-primary/50"
                                        value={selectedDeck}
                                        onChange={(event) => {
                                            setSelectedDeck(event.target.value);
                                            setMutationError(null);
                                        }}
                                    >
                                        {decks.map((deck) => (
                                            <option key={deck.id} value={deck.id}>
                                                {deck.nome} ({deck._count.cards} cards)
                                            </option>
                                        ))}
                                    </select>
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-muted-foreground" aria-hidden="true">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>

                                <div className="relative flex py-5 items-center" aria-hidden="true">
                                    <div className="grow border-t border-border"></div>
                                    <span className="shrink-0 mx-4 text-muted-foreground text-xs font-semibold uppercase tracking-wider">Ou</span>
                                    <div className="grow border-t border-border"></div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setCreating(true);
                                        setMutationError(null);
                                    }}
                                    className="w-full py-3 border-2 border-dashed border-primary/30 text-primary font-bold rounded-xl hover:bg-primary/10 hover:border-primary transition-all flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Criar Novo Grupo
                                </button>
                            </div>
                        )}

                        {(creating || decks.length === 0) && (
                            <div className="animate-in slide-in-from-right-2 duration-200">
                                <label htmlFor="save-modal-new-deck" className="block text-sm font-bold text-muted-foreground mb-2">Nome do novo grupo:</label>
                                <input
                                    id="save-modal-new-deck"
                                    type="text"
                                    maxLength={80}
                                    placeholder="Ex: Biologia Celular, Verbos Irregulares..."
                                    className="w-full p-3 border-2 border-border rounded-xl bg-card text-card-foreground placeholder-muted-foreground font-medium focus:border-ring focus:ring-4 focus:ring-ring/20 outline-none transition-all"
                                    value={newDeckName}
                                    onChange={(event) => {
                                        setNewDeckName(event.target.value);
                                        setMutationError(null);
                                    }}
                                    autoFocus
                                />

                                {decks.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreating(false);
                                            setMutationError(null);
                                        }}
                                        className="w-full mt-3 py-3 bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold rounded-xl border border-border transition-all flex items-center justify-center gap-2 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                        Voltar para lista
                                    </button>
                                )}
                            </div>
                        )}

                        <div className="flex gap-3 mt-6 pt-5 border-t border-border">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={saving}
                                className="flex-1 py-3 text-muted-foreground font-bold hover:bg-muted hover:text-foreground rounded-xl transition disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                onClick={creating || decks.length === 0 ? handleCreateAndSave : handleSaveExisting}
                                disabled={saving}
                                aria-busy={saving}
                                className="flex-2 py-3 bg-success-solid text-white font-bold rounded-xl hover:shadow-lg hover:shadow-success-solid/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" aria-hidden="true" />
                                        <span role="status">Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Confirmar</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}