"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import { listarMeusBaralhos, excluirBaralho } from "../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function ColecaoPage() {
    const { isLoaded, isSignedIn } = useUser();
    const [decks, setDecks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function carregar() {
            if (!isLoaded) return;

            if (!isSignedIn) {
                setLoading(false);
                return;
            }

            const dados = await listarMeusBaralhos();
            setDecks(dados);
            setLoading(false);
        }

        carregar();
    }, [isLoaded, isSignedIn]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-5xl">
                <div className="flex justify-between items-end mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">Minha Coleção 📚</h1>
                        <p className="text-gray-500">Seus grupos de estudo organizados.</p>
                    </div>
                    <Link href="/">
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-blue-700 transition shadow-md">
                            + Novo Estudo
                        </button>
                    </Link>
                </div>

                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {!loading && decks.length === 0 && isSignedIn && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
                        <div className="text-6xl mb-4">🗂️</div>
                        <h3 className="text-xl font-bold text-gray-800">Nenhum grupo encontrado</h3>
                        <p className="text-gray-500 mb-6">Crie seu primeiro material de estudo na página inicial.</p>
                        <Link href="/">
                            <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                                Criar Agora
                            </button>
                        </Link>
                    </div>
                )}

                {/* GRID DE BARALHOS (DECKS) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {decks.map((deck) => (
                        <div key={deck.id} className="relative group">

                            {/* LINK PARA ABRIR (Envolve todo o card) */}
                            <Link href={`/colecao/${deck.id}`}>
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden h-full">
                                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-cyan-400 group-hover:h-2 transition-all" />

                                    <div className="flex items-start justify-between mb-4">
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"></path></svg>
                                        </div>
                                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-full">
                                            {deck._count.cards} cards
                                        </span>
                                    </div>

                                    <h3 className="text-xl font-bold text-gray-800 mb-1 group-hover:text-blue-600 transition-colors">
                                        {deck.nome}
                                    </h3>
                                    <p className="text-xs text-gray-400">
                                        Criado em {new Date(deck.createdAt).toLocaleDateString('pt-BR')}
                                    </p>
                                </div>
                            </Link>

                            {/* BOTÃO DE EXCLUIR DECK (Agora no canto inferior direito, mais seguro e visível) */}
                            <button
                                onClick={async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation(); // Garante que não abre o link
                                    if (confirm(`Excluir a pasta "${deck.nome}" e todos os cards dentro?`)) {
                                        await excluirBaralho(deck.id);
                                        setDecks(decks.filter(d => d.id !== deck.id));
                                    }
                                }}
                                className="absolute bottom-4 right-4 z-20 p-2 bg-white/90 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50 shadow-sm border border-gray-100 transition-all"
                                title="Excluir pasta"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}