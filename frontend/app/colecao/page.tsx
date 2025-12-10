"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import Flashcard from "../components/Flashcard";
import { listarMinhaColecao } from "../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

export default function ColecaoPage() {
    const { isLoaded, isSignedIn } = useUser();
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function carregar() {
            if (!isLoaded) return;

            // Se não estiver logado, nem busca
            if (!isSignedIn) {
                setLoading(false);
                return;
            }

            const dados = await listarMinhaColecao();
            setCards(dados);
            setLoading(false);
        }

        carregar();
    }, [isLoaded, isSignedIn]);

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-5xl">
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Minha Coleção 📚</h1>
                <p className="text-gray-500 mb-8">Todos os seus flashcards salvos e grupos de estudo.</p>

                {/* LOADING STATE */}
                {loading && (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin h-10 w-10 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                )}

                {/* EMPTY STATE (Sem cards) */}
                {!loading && cards.length === 0 && isSignedIn && (
                    <div className="text-center py-20 bg-white rounded-3xl border border-gray-200 shadow-sm">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-gray-800">Sua coleção está vazia</h3>
                        <p className="text-gray-500 mb-6">Você ainda não salvou nenhum material de estudo.</p>
                        <Link href="/">
                            <button className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition">
                                Criar meus primeiros Flashcards
                            </button>
                        </Link>
                    </div>
                )}

                {/* GRID DE CARDS */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card, index) => (
                        <Flashcard
                            key={card.id}
                            index={index} // Aqui é só visual, mostra 1, 2, 3...
                            frente={card.frente}
                            verso={card.verso}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}