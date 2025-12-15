"use client";

import { useState } from "react";
import Header from "../../components/Header";
import { gerarSalvarPlano } from "../../actions";
import { useRouter } from "next/navigation";

export default function NovoPlanoPage() {
    const router = useRouter();
    const [tema, setTema] = useState("");
    const [dificuldade, setDificuldade] = useState("Iniciante");
    const [loading, setLoading] = useState(false);

    async function handleGerar() {
        if (!tema.trim()) return alert("Digite um tema!");
        
        setLoading(true);
        const resultado = await gerarSalvarPlano(tema, dificuldade);
        
        if (resultado.success) {
            router.push(`/planos/${resultado.planoId}`);
        } else {
            alert(resultado.error);
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-background flex flex-col items-center p-4 md:p-6 transition-colors duration-300">
            <Header />

            <div className="w-full max-w-2xl mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-card p-6 md:p-10 rounded-3xl shadow-xl border border-border text-left">
                    
                    {/* Título mais integrado à página */}
                    <div className="mb-8 border-b border-border pb-6">
                        <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
                            O que vamos aprender?
                        </h1>
                        <p className="text-muted-foreground mt-2 text-lg">
                            Defina sua meta e montaremos um roteiro passo a passo.
                        </p>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wide">
                                Tópico ou Habilidade
                            </label>
                            <input 
                                type="text" 
                                placeholder="Ex: React.js, História da Arte, Física Quântica..."
                                className="w-full p-4 border border-input rounded-2xl bg-muted text-foreground placeholder:text-muted-foreground focus:bg-background focus:ring-4 focus:ring-primary/20 focus:border-primary outline-none text-lg transition-all"
                                value={tema}
                                onChange={(e) => setTema(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-foreground mb-3 uppercase tracking-wide">
                                Seu Nível Atual
                            </label>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                {["Iniciante", "Intermediário", "Avançado"].map((nivel) => (
                                    <button
                                        key={nivel}
                                        onClick={() => setDificuldade(nivel)}
                                        className={`py-4 rounded-xl font-bold transition-all border ${
                                            dificuldade === nivel 
                                            ? "bg-primary text-primary-foreground border-primary shadow-md transform scale-[1.02]" 
                                            : "bg-background text-muted-foreground border-border hover:border-primary hover:bg-muted"
                                        }`}
                                    >
                                        {nivel}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <button 
                            onClick={handleGerar}
                            disabled={loading}
                            className="w-full py-5 bg-foreground text-background font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:opacity-90 transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait flex justify-center items-center gap-3 text-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full"/>
                                    <span>Montando Estrutura...</span>
                                </>
                            ) : (
                                <>
                                    <span>Criar Roteiro de Estudos</span>
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
