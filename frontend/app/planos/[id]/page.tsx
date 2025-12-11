"use client";

import { useEffect, useState, use } from "react";
import Header from "../../components/Header";
import Flashcard from "../../components/Flashcard";
import { buscarPlanoPorId, gerarCardsParaTopico } from "../../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";

// Next.js 15+ Params
export default function DetalhesPlanoPage({ params }: { params: Promise<{ id: string }> }) {
    const { isLoaded, isSignedIn } = useUser();
    const [plano, setPlano] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [loadingTopicId, setLoadingTopicId] = useState<string | null>(null);
    const [id, setId] = useState<string>("");

    // Desenbrulha params
    useEffect(() => {
        params.then((p) => setId(p.id));
    }, [params]);

    // Carrega Plano
    useEffect(() => {
        if (!isLoaded || !id) return;
        carregarPlano();
    }, [isLoaded, isSignedIn, id]);

    async function carregarPlano() {
        const dados = await buscarPlanoPorId(id);
        setPlano(dados);
        setLoading(false);
    }

    async function handleGerarConteudo(topicId: string, topicTitle: string) {
        setLoadingTopicId(topicId);
        
        const res = await gerarCardsParaTopico(plano.title, topicId, topicTitle);
        
        if (res.success) {
            await carregarPlano(); // Recarrega para mostrar os novos cards
        } else {
            alert("Erro ao gerar conteúdo. Tente novamente.");
        }
        
        setLoadingTopicId(null);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex justify-center items-center">
                <div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!plano) return <div className="text-center p-10">Plano não encontrado.</div>;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6 md:p-12">
            <Header />

            <div className="w-full max-w-4xl">
                {/* Cabeçalho do Plano */}
                <div className="mb-10 text-center">
                    <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                        {plano.difficulty}
                    </span>
                    <h1 className="text-4xl font-extrabold text-gray-900 mb-4">{plano.title}</h1>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg">{plano.description}</p>
                </div>

                {/* Lista de Tópicos (Trilha) */}
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                    
                    {plano.topics.map((topic: any, index: number) => {
                        const temCards = topic._count.cards > 0;

                        return (
                            <div key={topic.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                
                                {/* Ícone Central (Timeline) */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-indigo-50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <span className="text-sm font-bold text-indigo-600">{index + 1}</span>
                                </div>
                                
                                {/* Card do Tópico */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-gray-800 text-lg">{topic.title}</h3>
                                        {temCards ? (
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold">
                                                {topic._count.cards} cards
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-md">
                                                Pendente
                                            </span>
                                        )}
                                    </div>

                                    {/* Ação */}
                                    <div className="mt-4">
                                        {!temCards ? (
                                            <button 
                                                onClick={() => handleGerarConteudo(topic.id, topic.title)}
                                                disabled={loadingTopicId === topic.id}
                                                className="w-full py-2 bg-indigo-50 text-indigo-600 font-bold rounded-lg hover:bg-indigo-100 transition flex justify-center items-center gap-2 text-sm"
                                            >
                                                {loadingTopicId === topic.id ? (
                                                    <span className="animate-pulse">Criando...</span>
                                                ) : (
                                                    <>✨ Gerar Conteúdo</>
                                                )}
                                            </button>
                                        ) : (
                                            <Link href={`/estudar?topicId=${topic.id}`} className="block">
                                                <button className="w-full py-2 border border-gray-200 text-gray-600 font-bold rounded-lg hover:bg-gray-50 transition text-sm">
                                                    Revisar Tópico
                                                </button>
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
                
                {/* Botão Estudar Tudo */}
                <div className="mt-12 text-center">
                    <Link href={`/estudar?planId=${plano.id}`}> 
                        <button className="bg-gray-900 text-white px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-gray-800 transition transform hover:-translate-y-1 active:scale-95">
                            Estudar Plano Completo 🚀
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}