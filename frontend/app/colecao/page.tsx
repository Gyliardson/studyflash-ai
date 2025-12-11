"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import { listarMeusBaralhos, excluirBaralho } from "../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ColecaoPage() {
    const { isLoaded, isSignedIn } = useUser();
    const router = useRouter();
    const [decks, setDecks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Estado para seleção múltipla
    const [selectedDecks, setSelectedDecks] = useState<string[]>([]);

    useEffect(() => {
        async function carregar() {
            if (!isLoaded) return;
            if (!isSignedIn) {
                setLoading(false);
                return;
            }
            try {
                const dados = await listarMeusBaralhos();
                setDecks(dados);
            } catch (error) {
                console.error("Erro ao carregar baralhos:", error);
            } finally {
                setLoading(false);
            }
        }
        carregar();
    }, [isLoaded, isSignedIn]);

    const toggleDeck = (id: string) => {
        if (selectedDecks.includes(id)) {
            setSelectedDecks(selectedDecks.filter(d => d !== id));
        } else {
            setSelectedDecks([...selectedDecks, id]);
        }
    };

    const handleEstudarSelecionados = () => {
        if (selectedDecks.length === 0) {
            router.push('/estudar'); // Global
        } else {
            const ids = selectedDecks.join(',');
            router.push(`/estudar?decks=${ids}`);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-5xl">
                {/* --- CABEÇALHO (Design do Foguete Mantido) --- */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Minha Coleção 📚</h1>
                        <p className="text-gray-500">Selecione as bolinhas para revisar grupos específicos.</p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleEstudarSelecionados}
                            className={`px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all transform hover:-translate-y-1 active:scale-95 flex items-center gap-2
                                ${selectedDecks.length > 0
                                    ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/30 ring-2 ring-indigo-200 ring-offset-2"
                                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-500/30"
                                }
                            `}
                        >
                            <span>🚀</span>
                            <span>
                                {selectedDecks.length > 0
                                    ? `Estudar ${selectedDecks.length} Selecionado(s)`
                                    : "Modo Global (Tudo)"
                                }
                            </span>
                        </button>

                        <Link href="/">
                            <button className="bg-white text-gray-700 border border-gray-200 px-6 py-3 rounded-xl font-bold shadow-sm hover:shadow-lg hover:shadow-gray-200/50 hover:bg-gray-50 transition transform hover:-translate-y-1 active:scale-95 flex items-center gap-2 h-full">
                                + Novo
                            </button>
                        </Link>
                    </div>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {!loading && decks.length === 0 && isSignedIn && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
                        <div className="text-6xl mb-4">🗂️</div>
                        <h3 className="text-xl font-bold text-gray-800">Sua coleção está vazia</h3>
                        <Link href="/">
                            <button className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                                Criar Agora
                            </button>
                        </Link>
                    </div>
                )}

                {/* GRID DE BARALHOS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {decks.map((deck) => {
                        const isSelected = selectedDecks.includes(deck.id);
                        return (
                            <div key={deck.id} className="relative group h-full">

                                {/* CHECKBOX DE SELEÇÃO 
                                    Adicionado: transform group-hover:-translate-y-1
                                */}
                                <div
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        toggleDeck(deck.id);
                                    }}
                                    className="absolute top-4 right-4 z-30 cursor-pointer p-2 transition-all duration-300 transform group-hover:-translate-y-1 hover:scale-110"
                                    title="Selecionar para estudar"
                                >
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shadow-sm
                                        ${isSelected
                                            ? "bg-indigo-500 border-indigo-500 scale-110"
                                            : "border-gray-300 bg-white group-hover:border-blue-400"
                                        }
                                    `}>
                                        {isSelected && <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
                                    </div>
                                </div>

                                {/* LINK PRINCIPAL (Card Body)
                                    Alterado: de hover:-translate-y-1 para group-hover:-translate-y-1
                                */}
                                <Link href={`/colecao/${deck.id}`} className="block h-full">
                                    <div className={`bg-white p-6 rounded-2xl border shadow-sm transition-all duration-300 relative overflow-hidden h-full transform group-hover:-translate-y-1 group-hover:shadow-xl
                                        ${isSelected ? "border-indigo-500 ring-1 ring-indigo-100" : "border-gray-200"}
                                    `}>
                                        {/* Barra de Gradiente */}
                                        <div className={`absolute top-0 left-0 w-full h-1 transition-all group-hover:h-2
                                            ${isSelected ? "bg-indigo-500" : "bg-gradient-to-r from-blue-500 to-cyan-400"}
                                        `} />

                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-3 rounded-xl transition-colors
                                                ${isSelected
                                                    ? "bg-indigo-100 text-indigo-600"
                                                    : "bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                                                }
                                            `}>
                                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                            </div>

                                            <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full mr-8">
                                                {deck._count.cards} cards
                                            </span>
                                        </div>

                                        <h3 className={`text-xl font-bold mb-1 truncate transition-colors ${isSelected ? "text-indigo-700" : "text-gray-800 group-hover:text-blue-600"}`}>
                                            {deck.nome}
                                        </h3>

                                        <p className="text-xs text-gray-400 mt-2">
                                            {new Date(deck.createdAt).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </Link>

                                {/* BOTÃO EXCLUIR (Lixeira) 
                                    Adicionado: transform group-hover:-translate-y-1
                                */}
                                <button
                                    onClick={async (e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (confirm(`Excluir "${deck.nome}"?`)) {
                                            await excluirBaralho(deck.id);
                                            setDecks(decks.filter(d => d.id !== deck.id));
                                            setSelectedDecks(selectedDecks.filter(id => id !== deck.id));
                                        }
                                    }}
                                    className="absolute bottom-4 right-4 z-20 p-2 bg-white/80 backdrop-blur-sm rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-gray-100 transition-all duration-300 opacity-0 group-hover:opacity-100 hover:scale-110 transform group-hover:-translate-y-1"
                                    title="Excluir pasta"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}