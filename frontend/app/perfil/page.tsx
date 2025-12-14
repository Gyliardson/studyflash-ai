"use client";

import { useEffect, useState } from "react";
import Header from "../components/Header";
import { obterPerfilUsuario } from "../actions";
import { calcularNivel } from "@/lib/gamification";
import { useUser } from "@clerk/nextjs";

export default function PerfilPage() {
    const { user } = useUser();
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        obterPerfilUsuario().then((data) => {
            setProfile(data);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex justify-center items-center">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-600 rounded-full border-t-transparent"></div>
        </div>
    );

    const { level, progress, xpToNext } = calcularNivel(profile?.xp || 0);

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center p-4 md:p-6 transition-colors duration-300">
            <Header />

            <div className="w-full max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
                
                {/* --- CARTÃO PRINCIPAL --- */}
                <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-xl overflow-hidden border border-gray-100 dark:border-slate-800 mb-8 relative">
                    
                    {/* 1. Header Colorido (Aumentei um pouco para h-40 para dar respiro) */}
                    <div className="h-40 bg-linear-to-r from-indigo-600 to-purple-600 relative overflow-hidden">
                        {/* Efeito decorativo sutil no fundo */}
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    </div>

                    <div className="px-6 md:px-8 pb-8">
                        {/* 2. Layout Flexível: Avatar sobe, Texto fica */}
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                            
                            {/* AVATAR: Margem Negativa para subir (-mt-16) */}
                            <div className="-mt-16 relative z-10 shrink-0">
                                <img 
                                    src={user?.imageUrl} 
                                    alt="Avatar" 
                                    className="w-32 h-32 rounded-3xl border-4 border-white dark:border-slate-900 shadow-xl bg-gray-200 dark:bg-slate-800 object-cover"
                                />
                            </div>

                            {/* TEXTO: Margem Top positiva (mt-4) para descer e ficar no branco */}
                            <div className="flex-1 mt-4 md:mt-2 text-center md:text-left">
                                <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 tracking-tight">{user?.fullName}</h1>
                                <div className="flex items-center justify-center md:justify-start gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 text-xs font-bold rounded-md border border-indigo-100 dark:border-indigo-800">
                                        Aluno
                                    </span>
                                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                                        Membro desde {user?.createdAt ? new Date(user.createdAt).getFullYear() : '2024'}
                                    </p>
                                </div>
                            </div>

                            {/* STATS: Alinhados à direita, também no branco */}
                            <div className="mt-4 md:mt-2 flex gap-6 bg-gray-50 dark:bg-slate-800 p-3 rounded-2xl border border-gray-100 dark:border-slate-700 w-full md:w-auto justify-center">
                                <div className="text-center px-2">
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-0.5">Nível</p>
                                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 leading-none">{level}</p>
                                </div>
                                <div className="w-px bg-gray-200 dark:bg-slate-700"></div>
                                <div className="text-center px-2">
                                    <p className="text-[10px] text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mb-0.5">XP Total</p>
                                    <p className="text-2xl font-black text-gray-800 dark:text-gray-200 leading-none">{profile?.xp || 0}</p>
                                </div>
                            </div>
                        </div>

                        {/* BARRA DE PROGRESSO */}
                        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl p-4 border border-gray-100/50 dark:border-slate-700/50">
                            <div className="mb-2 flex justify-between text-sm font-medium text-gray-600 dark:text-gray-300">
                                <span className="flex items-center gap-2">
                                    🚀 Próximo objetivo: <span className="font-bold text-indigo-600 dark:text-indigo-400">Nível {level + 1}</span>
                                </span>
                                <span className="text-gray-400 dark:text-gray-500 font-normal">{Math.floor(progress)}%</span>
                            </div>
                            
                            <div className="h-3 w-full bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden shadow-inner">
                                <div 
                                    className="h-full bg-linear-to-r from-indigo-500 to-purple-500 transition-all duration-1000 relative overflow-hidden"
                                    style={{ width: `${progress}%` }}
                                >
                                    {/* ADICIONADO: animate-stripes na classe abaixo */}
                                    <div className="absolute inset-0 w-full h-full animate-stripes bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-size-[1rem_1rem] opacity-50" />
                                </div>
                            </div>
                            <p className="text-xs text-right text-gray-400 dark:text-gray-500 mt-2">Faltam apenas <span className="font-bold text-gray-600 dark:text-gray-300">{xpToNext} XP</span> para subir!</p>
                        </div>
                    </div>
                </div>

                {/* --- GRID DE ESTATÍSTICAS (Cards inferiores) --- */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* STREAK */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-orange-50 dark:bg-orange-900/20 text-orange-500 rounded-2xl text-2xl shadow-sm">
                            🔥
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Ofensiva</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{profile?.currentStreak || 0} dias</p>
                        </div>
                    </div>

                    {/* RECORDE */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-yellow-50 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-500 rounded-2xl text-2xl shadow-sm">
                            🏆
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Recorde</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{profile?.longestStreak || 0} dias</p>
                        </div>
                    </div>

                    {/* XP SEMANAL */}
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 flex items-center gap-4 hover:-translate-y-1 transition-transform duration-300">
                        <div className="w-12 h-12 flex items-center justify-center bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-500 rounded-2xl text-2xl shadow-sm">
                            ⚡
                        </div>
                        <div>
                            <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider">Semana</p>
                            <p className="text-xl font-bold text-gray-800 dark:text-gray-100">{profile?.weeklyXp || 0} XP</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
