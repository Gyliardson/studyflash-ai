"use client";

import { useState, useEffect } from "react";
import { iniciarSimulado, finalizarSimulado, listarMeusBaralhos, listarMeusPlanos } from "@/app/actions";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function CustomDropdown({
    options,
    value,
    onChange,
    placeholder,
    icon,
    isActive
}: {
    options: { id: string; label: string }[],
    value: string,
    onChange: (val: string) => void,
    placeholder: string,
    icon: React.ReactNode,
    isActive: boolean
}) {
    return (
        <div className={`relative h-full rounded-xl border-2 transition-all ${isActive ? "border-primary bg-primary/10 shadow-sm" : "border-border hover:border-primary/50 hover:bg-muted"}`}>
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full pointer-events-none ${isActive ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`} aria-hidden="true">
                {icon}
            </div>
            <select
                aria-label={`Selecionar ${placeholder.toLowerCase()}`}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className={`w-full h-full min-h-24 md:min-h-0 appearance-none bg-transparent pl-16 pr-9 py-4 rounded-xl font-bold text-sm outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${isActive ? "text-primary" : "text-muted-foreground"}`}
            >
                <option value="" disabled>{placeholder}</option>
                {options.map((option) => (
                    <option key={option.id} value={option.id}>{option.label}</option>
                ))}
            </select>
            <span className="absolute top-1/2 right-3 -translate-y-1/2 text-xs opacity-50 pointer-events-none" aria-hidden="true">▼</span>
        </div>
    );
}

const DIFFICULTIES = {
    EASY: {
        id: 'EASY', label: "Prática", description: "Sem tempo.", timePerQuestion: 0, multiplier: 1,
        color: "text-success-fg", bg: "bg-success-bg", border: "border-success-border", ring: "ring-success-ring",
        icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    MEDIUM: {
        id: 'MEDIUM', label: "Exame", description: "1m 30s / questão", timePerQuestion: 90, multiplier: 2,
        color: "text-warning-fg", bg: "bg-warning-bg", border: "border-warning-border", ring: "ring-warning-ring",
        icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    HARD: {
        id: 'HARD', label: "Difícil", description: "45s / questão", timePerQuestion: 45, multiplier: 3,
        color: "text-danger-fg", bg: "bg-danger-bg", border: "border-danger-border", ring: "ring-danger-ring",
        icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    IMPOSSIBLE: {
        id: 'IMPOSSIBLE', label: "Impossível", description: "20s / questão 🔥", timePerQuestion: 20, multiplier: 5,
        color: "text-info-fg", bg: "bg-info-bg", border: "border-info-border", ring: "ring-info-ring",
        icon: <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
    }
};

type ExamStep = 'CONFIG' | 'LOADING' | 'EXAM' | 'FINALIZE_ERROR' | 'RESULT';
type ExamAnswer = { flashcardId: string; selectedOption: string | null; timeTaken: number };

export default function SimuladoContent() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState<ExamStep>('CONFIG');
    const [loadingText, setLoadingText] = useState("Preparando sua prova...");
    const [decks, setDecks] = useState<any[]>([]);
    const [planos, setPlanos] = useState<any[]>([]);
    const [sourceType, setSourceType] = useState<'GLOBAL' | 'DECK' | 'TOPIC' | 'PLAN'>('GLOBAL');
    const [sourceId, setSourceId] = useState<string>("");
    const [quantity, setQuantity] = useState(10);
    const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'IMPOSSIBLE'>('MEDIUM');
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [examCards, setExamCards] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<ExamAnswer[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<number>(0);
    const [questionStartTime, setQuestionStartTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState<number>(0);
    const [finalResult, setFinalResult] = useState<any>(null);
    const [configError, setConfigError] = useState<string | null>(null);
    const [finalizeError, setFinalizeError] = useState<string | null>(null);

    useEffect(() => {
        Promise.all([listarMeusBaralhos(), listarMeusPlanos()]).then(([d, p]) => {
            setDecks(d);
            setPlanos(p);
            const deckParam = searchParams.get('deckId');
            const topicParam = searchParams.get('topicId');
            const planParam = searchParams.get('planId');
            if (deckParam) { setSourceType('DECK'); setSourceId(deckParam); }
            else if (topicParam) { setSourceType('TOPIC'); setSourceId(topicParam); }
            else if (planParam) { setSourceType('PLAN'); setSourceId(planParam); }
        });
    }, [searchParams]);

    useEffect(() => {
        if (step !== 'EXAM') return;
        const limit = DIFFICULTIES[difficulty].timePerQuestion;
        if (limit === 0) return;
        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    confirmAnswer(null, true);
                    return limit;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [step, currentIndex, difficulty]);

    async function handleStartExam() {
        setConfigError(null);
        setFinalizeError(null);

        if (sourceType !== 'GLOBAL' && !sourceId) {
            setConfigError("Selecione um baralho, trilha ou tópico antes de iniciar o simulado.");
            return;
        }

        setStep('LOADING');
        setLoadingText("Preparando questões a partir dos seus flashcards…");

        try {
            const res = await iniciarSimulado(sourceType, sourceId || undefined, quantity, difficulty);
            if (!res.success || !res.cards || res.cards.length === 0 || !res.attemptId) {
                setConfigError(res.error || "Não foi possível preparar o simulado. Verifique se há flashcards suficientes e tente novamente.");
                setStep('CONFIG');
                return;
            }

            setAttemptId(res.attemptId);
            setExamCards(res.cards);
            setCurrentIndex(0);
            setAnswers([]);
            setStartTime(Date.now());
            setQuestionStartTime(Date.now());
            if (DIFFICULTIES[difficulty].timePerQuestion > 0) setTimeLeft(DIFFICULTIES[difficulty].timePerQuestion);
            setStep('EXAM');
        } catch (error) {
            console.error("Erro ao iniciar simulado:", error);
            setConfigError("Não foi possível iniciar o simulado agora. Confira sua conexão e tente novamente.");
            setStep('CONFIG');
        }
    }

    async function confirmAnswer(optionSelected: string | null, timeOut: boolean = false) {
        const timeTaken = (Date.now() - questionStartTime) / 1000;
        const currentCard = examCards[currentIndex];
        const newAnswer: ExamAnswer = { flashcardId: currentCard.id, selectedOption: timeOut ? null : optionSelected, timeTaken };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);
        setSelectedOption(null);
        if (currentIndex < examCards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setQuestionStartTime(Date.now());
            if (DIFFICULTIES[difficulty].timePerQuestion > 0) setTimeLeft(DIFFICULTIES[difficulty].timePerQuestion);
        } else {
            void finishExam(newAnswers);
        }
    }

    async function finishExam(finalAnswers: ExamAnswer[]) {
        setFinalizeError(null);
        setStep('LOADING');
        setLoadingText("Confirmando respostas e calculando o resultado…");

        if (!attemptId) {
            setConfigError("Esta tentativa não está mais disponível. Inicie um novo simulado para continuar.");
            setStep('CONFIG');
            return;
        }

        const totalTime = (Date.now() - startTime) / 1000;

        try {
            const res = await finalizarSimulado({ attemptId, timeSpentSeconds: totalTime, answers: finalAnswers });
            if (res.success) {
                setFinalResult({ ...res, totalTime, limitReached: res.limitReached });
                setStep('RESULT');
                return;
            }

            setFinalizeError(res.error || "Não foi possível confirmar o resultado. Suas respostas continuam nesta tentativa e você pode tentar salvar novamente.");
            setStep('FINALIZE_ERROR');
        } catch (error) {
            console.error("Erro ao finalizar simulado:", error);
            setFinalizeError("Não foi possível confirmar o resultado por uma falha de conexão. Suas respostas continuam nesta tentativa e você pode tentar novamente.");
            setStep('FINALIZE_ERROR');
        }
    }

    return (
        <div className="w-full max-w-5xl px-4 md:px-6 py-8">
            <style jsx global>{`
                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #e5e7eb; border-radius: 9999px; }
                input[type=range]::-webkit-slider-thumb { height: 24px; width: 24px; border-radius: 50%; background: #4f46e5; cursor: pointer; -webkit-appearance: none; margin-top: -8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4); transition: transform 0.1s; }
                input[type=range]:active::-webkit-slider-thumb { transform: scale(1.1); }
            `}</style>

            {step === 'CONFIG' && (
                <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in duration-300">
                    <div className="bg-linear-to-r from-primary to-info-solid p-8 text-white relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-primary-foreground" aria-hidden="true">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                                    </div>
                                    <p className="text-xs font-bold uppercase tracking-widest opacity-80">Modo Exame</p>
                                </div>
                                <h1 className="text-3xl font-extrabold tracking-tight">Configuração de Prova</h1>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-8 space-y-8">
                        <fieldset className="space-y-4">
                            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-widest">1. Origem das Questões</legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:h-32">
                                <button type="button" aria-pressed={sourceType === 'GLOBAL'} onClick={() => { setSourceType('GLOBAL'); setSourceId(""); setConfigError(null); }} className={`group relative h-full rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center p-4 md:p-2 ${sourceType === 'GLOBAL' ? 'border-primary bg-primary/10 text-primary shadow-sm' : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted'}`}>
                                    <div className={`p-2 rounded-full transition-colors ${sourceType === 'GLOBAL' ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'}`} aria-hidden="true"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></div>
                                    <div className="font-bold text-xs">Global</div>
                                </button>
                                <CustomDropdown options={decks.map(d => ({ id: d.id, label: d.nome }))} value={sourceType === 'DECK' ? sourceId : ''} onChange={(val) => { setSourceType('DECK'); setSourceId(val); setConfigError(null); }} placeholder="Baralho" isActive={sourceType === 'DECK'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>} />
                                <CustomDropdown options={planos.map(p => ({ id: p.id, label: p.title }))} value={sourceType === 'PLAN' ? sourceId : ''} onChange={(val) => { setSourceType('PLAN'); setSourceId(val); setConfigError(null); }} placeholder="Trilha" isActive={sourceType === 'PLAN'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.08 12.08 0 0118.825 17 11.95 11.95 0 0012 20.055 11.95 11.95 0 005.176 17a12.08 12.08 0 01.665-6.422L12 14z" /></svg>} />
                                <CustomDropdown options={planos.flatMap(p => p.topics.map((t:any) => ({ id: t.id, label: `${p.title} - ${t.title}` })))} value={sourceType === 'TOPIC' ? sourceId : ''} onChange={(val) => { setSourceType('TOPIC'); setSourceId(val); setConfigError(null); }} placeholder="Tópico" isActive={sourceType === 'TOPIC'} icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>} />
                            </div>
                        </fieldset>

                        <fieldset className="space-y-4">
                            <legend className="text-xs font-bold text-muted-foreground uppercase tracking-widest">2. Intensidade</legend>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.values(DIFFICULTIES).map((diff) => (
                                    <button type="button" aria-pressed={difficulty === diff.id} key={diff.id} onClick={() => setDifficulty(diff.id as any)} className={`p-3 rounded-2xl border-2 text-left transition-all relative group flex flex-col justify-between h-full min-h-[120px] ${difficulty === diff.id ? `${diff.border} ${diff.bg} ${diff.ring} ring-1 shadow-md` : "border-border hover:border-border/80 hover:bg-muted"}`}>
                                        <div><div className={`font-bold ${diff.color} flex items-center gap-2 text-sm mb-1`}>{diff.icon}{diff.label}</div><div className="text-[10px] text-muted-foreground font-medium leading-relaxed">{diff.description}</div></div>
                                        <div className={`mt-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border w-max ${diff.border} bg-card text-muted-foreground`}>XP x{diff.multiplier}</div>
                                    </button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label htmlFor="exam-question-count" className="text-xs font-bold text-muted-foreground uppercase tracking-widest">3. Volume</label>
                                <span className="text-2xl font-black text-primary tabular-nums" aria-live="polite">{quantity} <span className="text-sm font-medium text-muted-foreground">questões</span></span>
                            </div>
                            <div className="relative h-12 flex items-center">
                                <input id="exam-question-count" type="range" min="5" max="15" step="5" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="w-full z-10" />
                                <div className="absolute w-full flex justify-between px-1 text-[10px] font-bold text-muted-foreground bottom-0 pointer-events-none" aria-hidden="true"><span>5 (Rápido)</span><span>10 (Ideal)</span><span>15 (Max)</span></div>
                            </div>
                        </div>

                        {configError && (
                            <div role="alert" className="rounded-2xl border border-danger-border bg-danger-bg px-4 py-3 text-sm font-medium text-danger-fg">
                                {configError}
                            </div>
                        )}

                        <button type="button" onClick={handleStartExam} className="w-full py-5 bg-primary text-primary-foreground font-bold rounded-2xl text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 mt-8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            <span>Iniciar Simulado</span><svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                </div>
            )}

            {step === 'LOADING' && (
                <div className="flex flex-col items-center justify-center py-32 animate-in fade-in" role="status" aria-live="polite" aria-atomic="true">
                    <div className="relative mb-8" aria-hidden="true"><div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /><div className="absolute inset-0 flex items-center justify-center text-primary"><svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg></div></div>
                    <div className="w-full text-center px-4"><h2 className="text-xl font-bold text-foreground mb-2">{loadingText}</h2><p className="text-muted-foreground text-sm max-w-xs mx-auto">Aguarde enquanto o servidor confirma o estado desta tentativa.</p></div>
                </div>
            )}

            {step === 'EXAM' && examCards.length > 0 && (
                <div className="max-w-3xl mx-auto animate-in slide-in-from-right-8 duration-500 select-none">
                    <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex justify-between items-center mb-6 sticky top-4 z-40">
                        <div className="flex items-center gap-4"><div className="flex flex-col"><span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progresso</span><div className="text-xl font-black text-foreground leading-none" aria-live="polite">{currentIndex + 1} <span className="text-muted-foreground text-base">/ {examCards.length}</span></div></div></div>
                        {DIFFICULTIES[difficulty].timePerQuestion > 0 && (
                            <div role="timer" aria-label={`Tempo restante: ${timeLeft} segundos`} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors duration-300 ${timeLeft <= 10 ? 'bg-destructive/10 border-destructive text-destructive animate-pulse' : 'bg-muted border-border text-muted-foreground'}`}>
                                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg><span className="font-mono font-bold text-lg tabular-nums" aria-hidden="true">00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
                            </div>
                        )}
                    </div>
                    <div className="bg-card p-6 md:p-10 rounded-3xl shadow-lg border border-border mb-6 min-h-[180px] flex items-center justify-center text-center relative overflow-hidden group"><h2 className="text-2xl font-bold text-foreground leading-relaxed relative z-10">{examCards[currentIndex].frente}</h2></div>
                    <div className="grid grid-cols-1 gap-3" role="group" aria-label="Alternativas da questão">
                        {examCards[currentIndex].options.map((option: string, idx: number) => {
                            const letters = ["A", "B", "C", "D"];
                            const isSelected = selectedOption === option;
                            return <button type="button" key={idx} onClick={() => confirmAnswer(option)} className={`group relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center gap-5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${isSelected ? "border-primary bg-primary/10 text-primary shadow-md" : "border-border bg-card hover:border-primary/50 hover:bg-muted text-muted-foreground"}`}><span className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold shrink-0 ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`} aria-hidden="true">{letters[idx]}</span><span className="font-medium text-lg leading-snug">{option}</span></button>;
                        })}
                    </div>
                </div>
            )}

            {step === 'FINALIZE_ERROR' && (
                <section className="mx-auto max-w-xl rounded-3xl border border-danger-border bg-card p-6 md:p-8 shadow-xl" aria-labelledby="finalize-error-title">
                    <p className="text-xs font-bold uppercase tracking-widest text-danger-fg">Resultado ainda não confirmado</p>
                    <h2 id="finalize-error-title" className="mt-2 text-2xl font-black text-foreground">Suas respostas foram preservadas</h2>
                    <p role="alert" className="mt-3 text-sm leading-relaxed text-muted-foreground">{finalizeError}</p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <button type="button" onClick={() => void finishExam(answers)} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            Tentar salvar novamente
                        </button>
                        <button type="button" onClick={() => { setAttemptId(null); setExamCards([]); setAnswers([]); setFinalizeError(null); setConfigError("O resultado anterior não foi confirmado. Configure um novo simulado quando estiver pronto."); setStep('CONFIG'); }} className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-background px-5 py-3 font-bold text-foreground transition hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                            Voltar à configuração
                        </button>
                    </div>
                </section>
            )}

            {step === 'RESULT' && finalResult && (
                <div className="bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in duration-300 max-w-lg mx-auto">
                    <div className={`p-10 text-center text-white relative overflow-hidden ${finalResult.score >= 0.7 ? "bg-success-solid" : "bg-primary"}`}><div className="relative z-10"><div className="text-7xl mb-4 filter drop-shadow-md" aria-hidden="true">{finalResult.score >= 0.9 ? "👑" : finalResult.score >= 0.7 ? "🎉" : "💪"}</div><h2 className="text-3xl font-extrabold mb-1">Simulado Concluído!</h2><p className="opacity-90 font-medium">Desafio {DIFFICULTIES[finalResult.difficulty as keyof typeof DIFFICULTIES]?.label ?? "Concluído"} Finalizado</p></div></div>
                    <div className="p-8">
                        <div className="grid grid-cols-2 gap-4 mb-8"><div className="bg-muted p-5 rounded-2xl border border-border text-center"><div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Acertos</div><div className="text-3xl font-black text-foreground">{finalResult.correctAnswers}<span className="text-muted-foreground text-xl">/{finalResult.totalQuestions}</span></div></div><div className={`p-5 rounded-2xl border text-center ${finalResult.limitReached ? 'bg-muted border-border opacity-70' : 'bg-primary/10 border-primary/20'}`}><div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${finalResult.limitReached ? 'text-muted-foreground' : 'text-primary'}`}>{finalResult.limitReached ? "Limite Diário" : "XP Total"}</div><div className={`text-3xl font-black ${finalResult.limitReached ? 'text-muted-foreground' : 'text-primary'}`}>{finalResult.limitReached ? "MAX" : `+${finalResult.xpGained}`}</div></div></div>
                        {finalResult.limitReached && <div role="status" className="mb-6 p-3 bg-warning-bg border border-warning-border rounded-xl text-xs text-warning-fg text-center">Você atingiu o limite de 3 simulados valendo XP por dia. Continue praticando para fixar o conteúdo! 🧠</div>}
                        <div className="space-y-3 mb-8"><div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border"><span className="text-sm font-medium text-muted-foreground">Tempo Total</span><span className="font-bold text-foreground">{Math.round(finalResult.totalTime)}s</span></div><div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border"><span className="text-sm font-medium text-muted-foreground">Precisão</span><span className={`font-bold ${finalResult.score >= 0.7 ? "text-success-fg" : "text-foreground"}`}>{Math.round(finalResult.score * 100)}%</span></div></div>
                        <Link href="/colecao" className="w-full py-4 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition shadow-lg flex justify-center items-center gap-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"><svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>Voltar para Coleção</Link>
                    </div>
                </div>
            )}
        </div>
    );
}
