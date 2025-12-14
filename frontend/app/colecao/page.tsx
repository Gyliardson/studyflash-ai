"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import Link from "next/link";
// FIX: Importação corrigida para 'excluirBaralho'
import { listarMeusBaralhos, listarMeusPlanos, criarBaralho, excluirBaralho, excluirPlano } from "../actions";

export default function ColecaoPage() {
    const [decks, setDecks] = useState<any[]>([]);
    const [planos, setPlanos] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'DECKS' | 'PLANOS'>('DECKS');
    const [isCreating, setIsCreating] = useState(false);
    const [newDeckName, setNewDeckName] = useState("");

    useEffect(() => {
        carregarDados();
    }, []);

    async function carregarDados() {
        setLoading(true);
        try {
            const [d, p] = await Promise.all([listarMeusBaralhos(), listarMeusPlanos()]);
            setDecks(d);
            setPlanos(p);
        } catch (error) {
            console.error("Erro ao carregar coleção:", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleCreateDeck() {
        if (!newDeckName.trim()) return;
        setIsCreating(true);
        const res = await criarBaralho(newDeckName);
        if (res.success) {
            setNewDeckName("");
            await carregarDados();
        } else {
            alert("Erro ao criar baralho");
        }
        setIsCreating(false);
    }

    async function handleDeleteDeck(id: string) {
        if (!confirm("Tem certeza que deseja excluir este baralho e todos os seus cards?")) return;
        await excluirBaralho(id);
        await carregarDados();
    }

    async function handleDeletePlan(id: string) {
        if (!confirm("Tem certeza que deseja excluir esta trilha de estudos?")) return;
        await excluirPlano(id);
        await carregarDados();
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 pb-20 transition-colors duration-300">
            <Header />

            <div className="max-w-5xl mx-auto px-4 md:px-6 mt-8">
                
                {/* === HEADER DA PÁGINA === */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100 tracking-tight mb-2">Minha Biblioteca</h1>
                        <p className="text-gray-500 dark:text-gray-400">Gerencie seus materiais de estudo e acompanhe seu progresso.</p>
                    </div>

                    {/* Botão Novo (Contextual) */}
                    {activeTab === 'DECKS' ? (
                        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                            <input 
                                type="text" 
                                placeholder="Nome do novo baralho..." 
                                // FIX: Adicionado text-gray-900 para garantir que o texto apareça
                                className="flex-1 w-full md:w-64 px-4 py-3 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
                                value={newDeckName}
                                onChange={(e) => setNewDeckName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreateDeck()}
                            />
                            <button 
                                onClick={handleCreateDeck}
                                disabled={isCreating || !newDeckName.trim()}
                                className="w-full sm:w-auto bg-indigo-600 dark:bg-indigo-500 text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-400 transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
                            >
                                {isCreating ? (
                                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                ) : (
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                )}
                                <span>Criar</span>
                            </button>
                        </div>
                    ) : (
                        <Link href="/planos/novo" className="w-full md:w-auto">
                            <button className="w-full bg-indigo-600 dark:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-400 transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                                <span>Gerar Novo Plano</span>
                            </button>
                        </Link>
                    )}
                </div>

                {/* === BANNER DESTAQUE: SIMULADO === */}
                <div className="mb-10 relative overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-indigo-100 dark:border-slate-800 shadow-xl shadow-indigo-500/5 group hover:shadow-indigo-500/10 transition-all">
                    <div className="absolute top-0 left-0 w-1 h-full bg-linear-to-b from-indigo-500 to-purple-600"></div>
                    <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5">
                            <div className="w-16 h-16 flex items-center justify-center bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Modo Simulado</h2>
                                    <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 text-[10px] font-bold uppercase tracking-wider rounded-md border border-yellow-200 dark:border-yellow-800">Novo</span>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 max-w-md text-sm md:text-base">
                                    Teste seus conhecimentos sob pressão. Escolha a dificuldade, o tempo e ganhe <span className="font-bold text-indigo-600 dark:text-indigo-400">muito mais XP</span>.
                                </p>
                            </div>
                        </div>
                        <Link href="/simulado" className="w-full md:w-auto">
                            <button className="w-full md:w-auto px-8 py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-bold rounded-xl shadow-lg hover:bg-black dark:hover:bg-gray-100 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3">
                                <span>Começar Prova</span>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </Link>
                    </div>
                </div>

                {/* === NAVEGAÇÃO POR ABAS === */}
                <div className="flex gap-6 border-b border-gray-200 dark:border-slate-800 mb-8 overflow-x-auto">
                    <button 
                        onClick={() => setActiveTab('DECKS')}
                        className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all relative whitespace-nowrap ${activeTab === 'DECKS' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        Baralhos
                        {activeTab === 'DECKS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('PLANOS')}
                        className={`pb-4 px-2 text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-all relative whitespace-nowrap ${activeTab === 'PLANOS' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path></svg>
                        Trilhas de Estudo
                        {activeTab === 'PLANOS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></div>}
                    </button>
                </div>

                {/* === CONTEÚDO: BARALHOS === */}
                {!loading && activeTab === 'DECKS' && (
                    decks.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {decks.map((deck) => (
                                <div key={deck.id} className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900 transition-all duration-300 relative">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl group-hover:bg-indigo-600 group-hover:text-white dark:group-hover:bg-indigo-500 transition-colors">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                                        </div>
                                        {/* LIXEIRA DOS DECKS (Invisível até Hover, sempre visível em mobile) */}
                                        <button 
                                            onClick={() => handleDeleteDeck(deck.id)}
                                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                            title="Excluir Baralho"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>
                                    </div>
                                    
                                    <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-1 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors truncate">{deck.nome}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{deck._count?.cards || 0} flashcards</p>
                                    
                                    <div className="flex gap-2">
                                        <Link href={`/colecao/${deck.id}`} className="flex-1">
                                            <button className="w-full py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-700 dark:text-gray-200 font-bold rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 hover:border-gray-300 dark:hover:border-slate-600 transition text-sm flex items-center justify-center gap-2">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                Editar
                                            </button>
                                        </Link>
                                        <Link href={`/estudar?deckId=${deck.id}`} className="flex-1">
                                            <button className="w-full py-2 bg-indigo-600 dark:bg-indigo-500 text-white font-bold rounded-lg hover:bg-indigo-700 dark:hover:bg-indigo-400 transition text-sm flex items-center justify-center gap-2 shadow-md shadow-indigo-200 dark:shadow-none">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                Estudar
                                            </button>
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Nenhum baralho criado</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">Crie seu primeiro deck para começar.</p>
                        </div>
                    )
                )}

                {/* === CONTEÚDO: PLANOS === */}
                {!loading && activeTab === 'PLANOS' && (
                    planos.length > 0 ? (
                        <div className="grid grid-cols-1 gap-4">
                            {planos.map((plano) => (
                                <div key={plano.id} className="group bg-white dark:bg-slate-900 p-6 rounded-2xl border border-gray-200 dark:border-slate-800 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-900 transition-all relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <Link href={`/planos/${plano.id}`} className="flex-1 flex items-center gap-4 w-full">
                                        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-xl group-hover:bg-purple-600 group-hover:text-white transition-colors shrink-0">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path></svg>
                                        </div>
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-indigo-700 dark:group-hover:text-indigo-400 transition-colors">{plano.title}</h3>
                                            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${plano.difficulty === 'Iniciante' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800'}`}>
                                                    {plano.difficulty}
                                                </span>
                                                <span>• {plano.topics?.length || 0} módulos</span>
                                            </div>
                                        </div>
                                    </Link>
                                    
                                    <div className="flex items-center gap-4 w-full md:w-auto justify-end">
                                         {/* LIXEIRA DOS PLANOS (Invisível até Hover) */}
                                        <button 
                                            onClick={(e) => {
                                                e.preventDefault();
                                                handleDeletePlan(plano.id);
                                            }}
                                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10"
                                            title="Excluir Plano"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                        </button>

                                        <div className="hidden md:block text-gray-400 dark:text-gray-600 group-hover:translate-x-1 transition-transform pointer-events-none">
                                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-gray-300 dark:border-slate-800">
                            <div className="w-20 h-20 bg-gray-50 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-600">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path></svg>
                            </div>
                            <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200">Nenhum plano de estudo</h3>
                            <p className="text-gray-500 dark:text-gray-400 mb-6">Peça para a IA gerar um roteiro completo para você.</p>
                            <Link href="/planos/novo">
                                <button className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Gerar agora &rarr;</button>
                            </Link>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
