"use client";

import { useEffect, useState, use } from "react";
import Header from "../../components/Header";
import Flashcard from "../../components/Flashcard";
import { listarCardsDoBaralho, excluirFlashcard } from "../../actions";
import Link from "next/link";

// Em Next.js 15+ (e versões recentes do 14), params é uma Promise
export default function DetalhesBaralhoPage({ params }: { params: Promise<{ id: string }> }) {
    const paramsUnwrapped = use(params); // Desembrulha a promise dos parametros
    const [cards, setCards] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        carregarCards();
    }, []);

    async function carregarCards() {
        const dados = await listarCardsDoBaralho(paramsUnwrapped.id);
        setCards(dados);
        setLoading(false);
    }

    async function handleExcluirCard(id: string) {
        const res = await excluirFlashcard(id);
        if (res.success) {
            // Remove da tela sem precisar recarregar tudo
            setCards(cards.filter(c => c.id !== id));
        } else {
            alert("Erro ao excluir.");
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-5xl">
                <div className="flex items-center gap-4 mb-8">
                    <Link
                        href="/colecao"
                        className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 font-semibold rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 hover:text-blue-600 transition-all"
                    >
                        <span>←</span> Voltar
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-800">Estudando o Grupo</h1>
                </div>

                {loading && <div className="text-center py-20">Carregando cartas...</div>}

                {!loading && cards.length === 0 && (
                    <div className="text-center py-20 text-gray-500">Este grupo está vazio.</div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {cards.map((card, index) => (
                        <Flashcard
                            key={card.id}
                            index={index}
                            frente={card.frente}
                            verso={card.verso}
                            onDelete={() => handleExcluirCard(card.id)} // Passamos a função de deletar!
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}