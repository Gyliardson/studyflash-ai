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
        <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
            <Header />

            <div className="w-full max-w-2xl mt-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-10 rounded-3xl shadow-xl border border-gray-100 text-left">
                    
                    {/* Título mais integrado à página */}
                    <div className="mb-8 border-b border-gray-100 pb-6">
                        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                            O que vamos aprender?
                        </h1>
                        <p className="text-gray-500 mt-2 text-lg">
                            Defina sua meta e montaremos um roteiro passo a passo.
                        </p>
                    </div>

                    <div className="space-y-8">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                                Tópico ou Habilidade
                            </label>
                            <input 
                                type="text" 
                                placeholder="Ex: React.js, História da Arte, Física Quântica..."
                                className="w-full p-4 border border-gray-200 rounded-2xl bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:ring-4 focus:ring-indigo-50 focus:border-indigo-500 outline-none text-lg transition-all"
                                value={tema}
                                onChange={(e) => setTema(e.target.value)}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-3 uppercase tracking-wide">
                                Seu Nível Atual
                            </label>
                            <div className="grid grid-cols-3 gap-4">
                                {["Iniciante", "Intermediário", "Avançado"].map((nivel) => (
                                    <button
                                        key={nivel}
                                        onClick={() => setDificuldade(nivel)}
                                        className={`py-4 rounded-xl font-bold transition-all border ${
                                            dificuldade === nivel 
                                            ? "bg-indigo-600 text-white border-indigo-600 shadow-md transform scale-[1.02]" 
                                            : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
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
                            className="w-full py-5 bg-linear-to-r from-gray-900 to-gray-800 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:to-black transition-all transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-wait flex justify-center items-center gap-3 text-lg"
                        >
                            {loading ? (
                                <>
                                    <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"/>
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