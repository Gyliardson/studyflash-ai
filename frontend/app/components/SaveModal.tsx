"use client";

import { useState, useEffect } from "react";
import { criarBaralho, listarMeusBaralhos, salvarFlashcards } from "../actions";

interface SaveModalProps {
    cards: { frente: string; verso: string }[];
    onClose: () => void;
    onSuccess: () => void;
}

export default function SaveModal({ cards, onClose, onSuccess }: SaveModalProps) {
    const [decks, setDecks] = useState<any[]>([]);
    const [selectedDeck, setSelectedDeck] = useState("");
    const [newDeckName, setNewDeckName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [creating, setCreating] = useState(false);

    useEffect(() => {
        listarMeusBaralhos().then((data) => {
            setDecks(data);
            if (data.length > 0) setSelectedDeck(data[0].id);
            setLoading(false);
        });
    }, []);

    async function handleCreateAndSave() {
        if (!newDeckName.trim()) return alert("Digite um nome para o grupo!");
        setSaving(true);

        const resDeck = await criarBaralho(newDeckName);

        // --- Tratamento de erro específico ---
        if (!resDeck.success || !resDeck.deck) {
            setSaving(false);
            // Mostra o erro exato que veio do backend (ex: "Já existe um grupo...")
            return alert(resDeck.error || "Erro ao criar grupo.");
        }
        // ---------------------------------------------------

        await salvarFlashcards(cards, resDeck.deck.id);
        setSaving(false);
        onSuccess();
    }

    async function handleSaveExisting() {
        if (!selectedDeck) return alert("Selecione um grupo!");
        setSaving(true);
        await salvarFlashcards(cards, selectedDeck);
        setSaving(false);
        onSuccess();
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-100 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200 border border-gray-100">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Onde vamos guardar? 🗂️</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* LOADING */}
                {loading && (
                    <div className="flex flex-col items-center py-8 text-gray-500">
                        <div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                        <p className="text-sm">Buscando seus grupos...</p>
                    </div>
                )}

                {/* CONTEÚDO */}
                {!loading && (
                    <div className="space-y-5">

                        {/* MODO: SELECIONAR EXISTENTE */}
                        {decks.length > 0 && !creating && (
                            <div className="animate-in slide-in-from-left-2 duration-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Escolha um grupo existente:</label>
                                <div className="relative">
                                    <select
                                        className="w-full p-3 pl-4 pr-10 border border-gray-300 rounded-xl bg-white text-gray-900 font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none appearance-none transition-all cursor-pointer hover:border-blue-300"
                                        value={selectedDeck}
                                        onChange={(e) => setSelectedDeck(e.target.value)}
                                    >
                                        {decks.map((deck) => (
                                            <option key={deck.id} value={deck.id}>
                                                {deck.nome} ({deck._count.cards} cards)
                                            </option>
                                        ))}
                                    </select>
                                    {/* Ícone customizado do Select */}
                                    <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-gray-500">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </div>

                                <div className="relative flex py-5 items-center">
                                    <div className="grow border-t border-gray-200"></div>
                                    <span className="shrink-0 mx-4 text-gray-400 text-xs font-semibold uppercase tracking-wider">Ou</span>
                                    <div className="grow border-t border-gray-200"></div>
                                </div>

                                <button
                                    onClick={() => setCreating(true)}
                                    className="w-full py-3 border-2 border-dashed border-blue-200 text-blue-600 font-bold rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all flex items-center justify-center gap-2"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                                    Criar Novo Grupo
                                </button>
                            </div>
                        )}

                        {/* MODO: CRIAR NOVO */}
                        {(creating || decks.length === 0) && (
                            <div className="animate-in slide-in-from-right-2 duration-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2">Nome do novo grupo:</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Biologia Celular, Verbos Irregulares..."
                                    className="w-full p-3 border-2 border-blue-100 rounded-xl bg-white text-gray-900 placeholder-gray-400 font-medium focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                                    value={newDeckName}
                                    onChange={(e) => setNewDeckName(e.target.value)}
                                    autoFocus
                                />

                                {/* BOTÃO VOLTAR MELHORADO */}
                                {decks.length > 0 && (
                                    <button
                                        onClick={() => setCreating(false)}
                                        className="w-full mt-3 py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 font-semibold rounded-xl border border-gray-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                        Voltar para lista
                                    </button>
                                )}
                            </div>
                        )}

                        {/* AÇÕES PRINCIPAIS */}
                        <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
                            <button
                                onClick={onClose}
                                className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 hover:text-gray-700 rounded-xl transition"
                            >
                                Cancelar
                            </button>

                            <button
                                onClick={creating || decks.length === 0 ? handleCreateAndSave : handleSaveExisting}
                                disabled={saving}
                                className="flex-2 py-3 bg-linear-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-green-500/30 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                                        <span>Salvando...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Confirmar</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
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