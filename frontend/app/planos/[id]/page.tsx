"use client";

import { useEffect, useState, use } from "react";
import Header from "../../components/Header";
import Flashcard from "../../components/Flashcard";
import { buscarPlanoPorId, gerarCardsParaTopico } from "../../actions";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { triggerHudRefresh } from "../../components/UserHUD";

// Next.js 15+ Params
export default function DetalhesPlanoPage({ params }: { params: Promise<{ id: string }> }) {
    const { isLoaded, isSignedIn } = useUser();
    const [plano, setPlano] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    
    // CORREÇÃO 1: Usar Array para suportar múltiplos loadings simultâneos
    const [generatingTopicIds, setGeneratingTopicIds] = useState<string[]>([]);
    
    const [id, setId] = useState<string>("");

    // Desembrulha params
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
        // CORREÇÃO 2: Adiciona o ID na lista de "carregando"
        setGeneratingTopicIds((prev) => [...prev, topicId]);
        
        const res = await gerarCardsParaTopico(plano.title, topicId, topicTitle);
        
        if (res.success) {
            triggerHudRefresh();
            await carregarPlano(); // Recarrega para mostrar os novos cards
        } else {
            alert("Erro ao gerar conteúdo. Tente novamente.");
        }
        
        // CORREÇÃO 3: Remove o ID da lista, liberando o botão
        setGeneratingTopicIds((prev) => prev.filter((id) => id !== topicId));
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex justify-center items-center">
                <div className="animate-spin h-10 w-10 border-4 border-primary border-t-transparent rounded-full"></div>
            </div>
        );
    }

    if (!plano) return <div className="text-center p-10 text-muted-foreground">Plano não encontrado.</div>;

    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-12 transition-colors duration-300">
            <Header />

            <div className="w-full max-w-4xl">
                {/* Cabeçalho do Plano */}
                <div className="mb-10 text-center">
                    <span className="inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider mb-3">
                        {plano.difficulty}
                    </span>
                    <h1 className="text-4xl font-extrabold text-foreground mb-4">{plano.title}</h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg">{plano.description}</p>
                </div>

                {/* Lista de Tópicos (Trilha) */}
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-border before:to-transparent">
                    
                    {plano.topics.map((topic: any, index: number) => {
                        const temCards = topic._count.cards > 0;
                        // CORREÇÃO 4: Verifica se ESTE tópico está na lista de geração
                        const isGenerating = generatingTopicIds.includes(topic.id);

                        return (
                            <div key={topic.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                
                                {/* Ícone Central (Timeline) */}
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-primary/20 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                                </div>
                                
                                {/* Card do Tópico */}
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-card p-6 rounded-2xl shadow-sm border border-border hover:shadow-lg transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-foreground text-lg">{topic.title}</h3>
                                        {temCards ? (
                                            <span className="text-xs bg-success-bg text-success-fg border border-success-border px-2 py-1 rounded-md font-bold">
                                                {topic._count.cards} cards
                                            </span>
                                        ) : (
                                            <span className="text-xs bg-muted text-muted-foreground px-2 py-1 rounded-md">
                                                Pendente
                                            </span>
                                        )}
                                    </div>

                                    {/* Ação */}
                                    <div className="mt-4">
                                        {!temCards ? (
                                            <button 
                                                onClick={() => handleGerarConteudo(topic.id, topic.title)}
                                                disabled={isGenerating}
                                                className={`w-full py-2 font-bold rounded-lg transition flex justify-center items-center gap-2 text-sm
                                                    ${isGenerating 
                                                        ? "bg-primary/20 text-primary cursor-wait" 
                                                        : "bg-primary/10 text-primary hover:bg-primary/20"
                                                    }
                                                `}
                                            >
                                                {isGenerating ? (
                                                    <>
                                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                                                        <span>Criando...</span>
                                                    </>
                                                ) : (
                                                    <>✨ Gerar Conteúdo</>
                                                )}
                                            </button>
                                        ) : (
                                            <Link href={`/estudar?topicId=${topic.id}`} className="block">
                                                <button className="w-full py-2 border border-border text-muted-foreground font-bold rounded-lg hover:bg-muted transition text-sm">
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
                        <button className="bg-primary text-primary-foreground px-8 py-4 rounded-xl font-bold shadow-xl hover:bg-primary/90 transition transform hover:-translate-y-1 active:scale-95">
                            Estudar Plano Completo 🚀
                        </button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
