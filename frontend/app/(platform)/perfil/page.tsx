"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { obterPerfilUsuario } from "@/app/actions";
import { calcularNivel } from "@/lib/gamification";
import { useUser } from "@clerk/nextjs";
import { Settings } from "lucide-react";

type UserProfile = {
    xp: number;
    level: number;
    currentStreak: number;
    longestStreak?: number;
    weeklyXp: number;
};

export default function PerfilPage() {
    const { user } = useUser();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        let active = true;

        obterPerfilUsuario()
            .then((data) => {
                if (!active) return;
                setProfile(data);
                setLoadError(false);
            })
            .catch((error) => {
                console.error("Erro ao carregar perfil:", error);
                if (active) setLoadError(true);
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, []);

    if (loading) return (
        <main className="min-h-screen bg-background flex justify-center items-center" role="status" aria-live="polite" aria-label="Carregando perfil">
            <div className="animate-spin h-8 w-8 border-4 border-primary rounded-full border-t-transparent" aria-hidden="true"></div>
            <span className="sr-only">Carregando perfil</span>
        </main>
    );

    if (loadError) return (
        <main className="min-h-screen bg-background px-4 py-12 md:px-6">
            <div role="alert" className="mx-auto max-w-2xl rounded-3xl border border-danger-border bg-danger-bg p-6 text-danger-fg shadow-sm">
                <h1 className="text-xl font-extrabold">Não foi possível carregar seu perfil.</h1>
                <p className="mt-2 text-sm leading-6">Suas métricas não foram substituídas por valores estimados. Atualize a página para tentar consultar os dados novamente.</p>
                <button type="button" onClick={() => window.location.reload()} className="mt-5 rounded-xl bg-foreground px-4 py-2.5 text-sm font-bold text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    Tentar novamente
                </button>
            </div>
        </main>
    );

    const { level, progress, xpToNext } = calcularNivel(profile?.xp || 0);
    const safeProgress = Math.max(0, Math.min(100, progress));
    const memberSince = user?.createdAt ? new Date(user.createdAt).getFullYear() : null;
    const displayName = user?.fullName || user?.firstName || "Seu perfil";
    const avatarLabel = user?.fullName ? `Avatar de ${user.fullName}` : "Avatar do usuário";

    return (
        <main className="min-h-screen bg-background flex flex-col items-center p-4 md:p-6 transition-colors duration-300">
            <div className="w-full max-w-4xl animate-in slide-in-from-bottom-4 duration-500">
                <section aria-labelledby="profile-title" className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border mb-8 relative">
                    <div className="h-40 bg-linear-to-r from-primary to-info-solid relative overflow-hidden" aria-hidden="true">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                    </div>

                    <div className="px-6 md:px-8 pb-8">
                        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 mb-6">
                            <div className="-mt-16 relative z-10 shrink-0">
                                {user?.imageUrl ? (
                                    <div
                                        role="img"
                                        aria-label={avatarLabel}
                                        className="w-32 h-32 rounded-3xl border-4 border-card shadow-xl bg-muted bg-cover bg-center"
                                        style={{ backgroundImage: `url(${JSON.stringify(user.imageUrl)})` }}
                                    />
                                ) : (
                                    <div className="flex h-32 w-32 items-center justify-center rounded-3xl border-4 border-card bg-muted text-3xl font-black text-muted-foreground shadow-xl" aria-label="Avatar indisponível">
                                        {displayName.slice(0, 1).toUpperCase()}
                                    </div>
                                )}
                            </div>

                            <div className="flex-1 mt-4 md:mt-2 text-center md:text-left">
                                <h1 id="profile-title" className="text-3xl font-bold text-foreground tracking-tight">{displayName}</h1>
                                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mt-1">
                                    <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-md border border-primary/20">Aluno</span>
                                    {memberSince && <p className="text-muted-foreground text-sm">Membro desde {memberSince}</p>}
                                </div>
                            </div>

                            <div className="flex w-full flex-col gap-3 md:w-auto md:items-end">
                                <Link href="/configuracoes" className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <Settings className="h-4 w-4" aria-hidden="true" />
                                    Configurações
                                </Link>
                                <dl className="flex gap-6 bg-muted p-3 rounded-2xl border border-border w-full md:w-auto justify-center">
                                    <div className="text-center px-2">
                                        <dt className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Nível</dt>
                                        <dd className="text-2xl font-black text-primary leading-none">{level}</dd>
                                    </div>
                                    <div className="w-px bg-border" aria-hidden="true"></div>
                                    <div className="text-center px-2">
                                        <dt className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">XP Total</dt>
                                        <dd className="text-2xl font-black text-foreground leading-none">{profile?.xp || 0}</dd>
                                    </div>
                                </dl>
                            </div>
                        </div>

                        <div className="bg-muted/50 rounded-xl p-4 border border-border">
                            <div className="mb-2 flex justify-between gap-4 text-sm font-medium text-foreground">
                                <span>Próximo objetivo: <span className="font-bold text-primary">Nível {level + 1}</span></span>
                                <span className="text-muted-foreground font-normal">{Math.floor(safeProgress)}%</span>
                            </div>

                            <div
                                role="progressbar"
                                aria-label={`Progresso para o nível ${level + 1}`}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-valuenow={Math.floor(safeProgress)}
                                className="h-3 w-full bg-secondary rounded-full overflow-hidden shadow-inner"
                            >
                                <div
                                    className="h-full bg-linear-to-r from-primary to-info-solid transition-all duration-1000 relative overflow-hidden"
                                    style={{ width: `${safeProgress}%` }}
                                >
                                    <div className="absolute inset-0 w-full h-full animate-stripes bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-size-[1rem_1rem] opacity-50" aria-hidden="true" />
                                </div>
                            </div>
                            <p className="text-xs text-right text-muted-foreground mt-2">Faltam <span className="font-bold text-foreground">{xpToNext} XP</span> para o próximo nível.</p>
                        </div>
                    </div>
                </section>

                <section aria-label="Estatísticas de estudo" className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-warning-bg text-warning-fg rounded-2xl text-2xl shadow-sm border border-warning-border" aria-hidden="true">🔥</div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Ofensiva</p>
                            <p className="text-xl font-bold text-foreground">{profile?.currentStreak || 0} dias</p>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-warning-bg text-warning-fg rounded-2xl text-2xl shadow-sm border border-warning-border" aria-hidden="true">🏆</div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Recorde</p>
                            <p className="text-xl font-bold text-foreground">{profile?.longestStreak || 0} dias</p>
                        </div>
                    </div>

                    <div className="bg-card p-6 rounded-2xl shadow-sm border border-border flex items-center gap-4">
                        <div className="w-12 h-12 flex items-center justify-center bg-success-bg text-success-fg rounded-2xl text-2xl shadow-sm border border-success-border" aria-hidden="true">⚡</div>
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Semana</p>
                            <p className="text-xl font-bold text-foreground">{profile?.weeklyXp || 0} XP</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    );
}
