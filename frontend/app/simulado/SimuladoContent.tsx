"use client";

import { useState, useEffect, useRef } from "react";
import { iniciarSimulado, finalizarSimulado, listarMeusBaralhos, listarMeusPlanos } from "../actions";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

// === COMPONENTES INTERNOS DE UI ===

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
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedLabel = options.find(o => o.id === value)?.label;

    return (
        <div className="relative h-full" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full h-full p-1 rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-3 text-center
                    ${isActive
                    ? 'border-primary bg-primary/10 shadow-sm'
                    : 'border-border hover:border-primary/50 hover:bg-muted'}`}
            >
                <div className={`p-3 rounded-full transition-colors ${isActive ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {icon}
                </div>
                <div className={`font-bold text-sm truncate max-w-[140px] px-2 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                    {selectedLabel || placeholder}
                </div>
                <div className="absolute top-3 right-3 text-[10px] opacity-30">▼</div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-popover rounded-xl shadow-2xl border border-border z-50 max-h-60 overflow-y-auto animate-in fade-in slide-in-from-top-2">
                    {options.length > 0 ? (
                        <div className="p-1 space-y-1">
                            {options.map((option) => (
                                <button
                                    key={option.id}
                                    onClick={() => {
                                        onChange(option.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors
                                        ${value === option.id
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        }
                                    `}
                                >
                                    {option.label}
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            Nenhum item encontrado.
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// === CONSTANTES DE DIFICULDADE ===
const DIFFICULTIES = {
    EASY: {
        id: 'EASY',
        label: "Prática",
        description: "Sem tempo.",
        timePerQuestion: 0,
        multiplier: 1,
        color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/20", border: "border-emerald-200 dark:border-emerald-800", ring: "ring-emerald-500",
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    MEDIUM: {
        id: 'MEDIUM',
        label: "Exame",
        description: "1m 30s / questão",
        timePerQuestion: 90,
        multiplier: 2,
        color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", border: "border-amber-200 dark:border-amber-800", ring: "ring-amber-500",
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    HARD: {
        id: 'HARD',
        label: "Difícil",
        description: "45s / questão",
        timePerQuestion: 45,
        multiplier: 3,
        color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", border: "border-rose-200 dark:border-rose-800", ring: "ring-rose-500",
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
    },
    IMPOSSIBLE: {
        id: 'IMPOSSIBLE',
        label: "Impossível",
        description: "20s / questão 🔥",
        timePerQuestion: 20,
        multiplier: 5,
        color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-900/20", border: "border-purple-200 dark:border-purple-800", ring: "ring-purple-500",
        icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
    }
};

type ExamStep = 'CONFIG' | 'LOADING' | 'EXAM' | 'RESULT';

export default function SimuladoContent() {
    const searchParams = useSearchParams();

    // --- ESTADOS ---
    const [step, setStep] = useState<ExamStep>('CONFIG');
    const [loadingText, setLoadingText] = useState("Preparando sua prova...");

    // Config
    const [decks, setDecks] = useState<any[]>([]);
    const [planos, setPlanos] = useState<any[]>([]);
    const [sourceType, setSourceType] = useState<'GLOBAL' | 'DECK' | 'TOPIC' | 'PLAN'>('GLOBAL');
    const [sourceId, setSourceId] = useState<string>("");
    const [quantity, setQuantity] = useState(10);
    const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD' | 'IMPOSSIBLE'>('MEDIUM');

    // Prova
    const [examCards, setExamCards] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState<{ flashcardId: string; isCorrect: boolean; timeTaken: number }[]>([]);
    const [selectedOption, setSelectedOption] = useState<string | null>(null);

    // Timers
    const [startTime, setStartTime] = useState<number>(0);
    const [questionStartTime, setQuestionStartTime] = useState<number>(0);
    const [timeLeft, setTimeLeft] = useState<number>(0);

    // Resultado
    const [finalResult, setFinalResult] = useState<any>(null);

    // Carregamento Inicial
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

    // Timer Logic
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

    // --- ACTIONS ---

    async function handleStartExam() {
        if (sourceType !== 'GLOBAL' && !sourceId) return alert("Selecione um Baralho, Trilha ou Tópico!");

        setStep('LOADING');
        setLoadingText("A IA está criando pegadinhas para suas questões...");

        const res = await iniciarSimulado(sourceType, sourceId || undefined, quantity);

        if (!res.success || !res.cards || res.cards.length === 0) {
            alert(res.error || "Erro ao gerar prova. Verifique se você tem cartões suficientes.");
            setStep('CONFIG');
            return;
        }

        setExamCards(res.cards);
        setCurrentIndex(0);
        setAnswers([]);
        setStartTime(Date.now());
        setQuestionStartTime(Date.now());
        if (DIFFICULTIES[difficulty].timePerQuestion > 0) {
            setTimeLeft(DIFFICULTIES[difficulty].timePerQuestion);
        }
        setStep('EXAM');
    }

    async function confirmAnswer(optionSelected: string | null, timeOut: boolean = false) {
        const timeTaken = (Date.now() - questionStartTime) / 1000;
        const currentCard = examCards[currentIndex];
        const isCorrect = !timeOut && optionSelected === currentCard.verso;

        const newAnswer = {
            flashcardId: currentCard.id,
            isCorrect,
            timeTaken
        };

        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);
        setSelectedOption(null);

        if (currentIndex < examCards.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setQuestionStartTime(Date.now());
            if (DIFFICULTIES[difficulty].timePerQuestion > 0) {
                setTimeLeft(DIFFICULTIES[difficulty].timePerQuestion);
            }
        } else {
            finishExam(newAnswers);
        }
    }

    async function finishExam(finalAnswers: typeof answers) {
        setStep('LOADING');
        setLoadingText("Calculando resultado...");

        const totalTime = (Date.now() - startTime) / 1000;
        const correctCount = finalAnswers.filter(a => a.isCorrect).length;

        const res = await finalizarSimulado({
            totalQuestions: examCards.length,
            correctAnswers: correctCount,
            timeSpentSeconds: totalTime,
            difficulty,
            sourceType,
            sourceId,
            answers: finalAnswers
        });

        if (res.success) {
            setFinalResult({
                ...res,
                totalTime,
                correctAnswers: correctCount,
                totalQuestions: examCards.length,
                limitReached: res.limitReached
            });
            setStep('RESULT');
        } else {
            alert("Erro ao salvar resultado.");
            setStep('CONFIG');
        }
    }

    const getSelectionName = () => {
        if (sourceType === 'GLOBAL') return "Todo o Conteúdo";
        if (sourceType === 'DECK') return decks.find(d => d.id === sourceId)?.nome || "Escolher...";
        if (sourceType === 'TOPIC') return planos.flatMap(p => p.topics).find((t:any) => t.id === sourceId)?.title || "Escolher...";
        if (sourceType === 'PLAN') return planos.find(p => p.id === sourceId)?.title || "Escolher...";
        return "...";
    };

    // --- RENDER ---

    return (
        <div className="w-full max-w-5xl px-4 md:px-6 py-8">
            <style jsx global>{`
                input[type=range] { -webkit-appearance: none; width: 100%; background: transparent; }
                input[type=range]::-webkit-slider-runnable-track { width: 100%; height: 8px; cursor: pointer; background: #e5e7eb; border-radius: 9999px; }
                input[type=range]::-webkit-slider-thumb { height: 24px; width: 24px; border-radius: 50%; background: #4f46e5; cursor: pointer; -webkit-appearance: none; margin-top: -8px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.4); transition: transform 0.1s; }
                input[type=range]:active::-webkit-slider-thumb { transform: scale(1.1); }
            `}</style>

            {/* === CONFIGURAÇÃO === */}
            {step === 'CONFIG' && (
                <div className="bg-card rounded-3xl shadow-xl overflow-hidden border border-border animate-in fade-in zoom-in duration-300">
                    <div className="bg-linear-to-r from-primary to-purple-600 p-8 text-white relative overflow-hidden">
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="p-2 bg-white/20 backdrop-blur-md rounded-lg text-primary-foreground">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                                    </div>
                                    <h2 className="text-xs font-bold uppercase tracking-widest opacity-80">Modo Exame</h2>
                                </div>
                                <h1 className="text-3xl font-extrabold tracking-tight">Configuração de Prova</h1>
                            </div>
                            <div className="hidden md:block opacity-20">
                                <svg className="w-32 h-32" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            </div>
                        </div>
                    </div>

                    <div className="p-4 md:p-8 space-y-8">
                        {/* 1. Origem - Fixed Mobile Spacing with grid-cols-2 for mobile too */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                1. Origem das Questões
                            </label>
                            {/* Changed grid-cols-2 to grid-cols-1 sm:grid-cols-2 for better mobile stacking */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 md:h-32">

                                <button
                                    onClick={() => { setSourceType('GLOBAL'); setSourceId(""); }}
                                    className={`group relative h-full rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-2 text-center p-4 md:p-2
                                        ${sourceType === 'GLOBAL'
                                        ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                        : 'border-border text-muted-foreground hover:border-primary/50 hover:bg-muted'}`}
                                >
                                    <div className={`p-2 rounded-full transition-colors ${sourceType === 'GLOBAL' ? 'bg-primary/20' : 'bg-muted group-hover:bg-primary/10'}`}>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </div>
                                    <div className="font-bold text-xs">Global</div>
                                </button>

                                <CustomDropdown
                                    options={decks.map(d => ({ id: d.id, label: d.nome }))}
                                    value={sourceType === 'DECK' ? sourceId : ''}
                                    onChange={(val) => { setSourceType('DECK'); setSourceId(val); }}
                                    placeholder="Baralho"
                                    isActive={sourceType === 'DECK'}
                                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>}
                                />

                                <CustomDropdown
                                    options={planos.map(p => ({ id: p.id, label: p.title }))}
                                    value={sourceType === 'PLAN' ? sourceId : ''}
                                    onChange={(val) => { setSourceType('PLAN'); setSourceId(val); }}
                                    placeholder="Trilha"
                                    isActive={sourceType === 'PLAN'}
                                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z"></path><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222"></path></svg>}
                                />

                                <CustomDropdown
                                    options={planos.flatMap(p => p.topics.map((t:any) => ({ id: t.id, label: `${p.title} - ${t.title}` })))}
                                    value={sourceType === 'TOPIC' ? sourceId : ''}
                                    onChange={(val) => { setSourceType('TOPIC'); setSourceId(val); }}
                                    placeholder="Tópico"
                                    isActive={sourceType === 'TOPIC'}
                                    icon={<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>}
                                />

                            </div>
                        </div>

                        {/* 2. Dificuldade - Fixed Mobile Spacing with grid-cols-2 */}
                        <div className="space-y-4">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                2. Intensidade
                            </label>
                            {/* Changed grid-cols-2 to grid-cols-1 sm:grid-cols-2 for better mobile stacking */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.values(DIFFICULTIES).map((diff) => (
                                    <button
                                        key={diff.id}
                                        onClick={() => setDifficulty(diff.id as any)}
                                        className={`p-3 rounded-2xl border-2 text-left transition-all relative group flex flex-col justify-between h-full min-h-[120px] ${
                                            difficulty === diff.id
                                            ? `${diff.border} ${diff.bg} ${diff.ring} ring-1 shadow-md`
                                            : "border-border hover:border-border/80 hover:bg-muted"
                                        }`}
                                    >
                                        <div>
                                            <div className={`font-bold ${diff.color} flex items-center gap-2 text-sm mb-1`}>
                                                {diff.icon}
                                                {diff.label}
                                            </div>
                                            <div className="text-[10px] text-muted-foreground font-medium leading-relaxed">{diff.description}</div>
                                        </div>
                                        <div className={`mt-2 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold border w-max ${diff.border} bg-card text-muted-foreground`}>
                                            XP x{diff.multiplier}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 3. Volume */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-end">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-primary"></span>
                                    3. Volume
                                </label>
                                <span className="text-2xl font-black text-primary tabular-nums">{quantity} <span className="text-sm font-medium text-muted-foreground">questões</span></span>
                            </div>
                            <div className="relative h-12 flex items-center">
                                <input
                                    type="range" min="5" max="15" step="5"
                                    value={quantity} onChange={(e) => setQuantity(Number(e.target.value))}
                                    className="w-full z-10"
                                />
                                <div className="absolute w-full flex justify-between px-1 text-[10px] font-bold text-muted-foreground bottom-0 pointer-events-none">
                                    <span>5 (Rápido)</span>
                                    <span>10 (Ideal)</span>
                                    <span>15 (Max)</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={handleStartExam}
                            className="w-full py-5 bg-primary text-primary-foreground font-bold rounded-2xl text-lg shadow-xl shadow-primary/20 hover:bg-primary/90 transition transform hover:-translate-y-1 active:scale-95 flex items-center justify-center gap-3 mt-8"
                        >
                            <span>Iniciar Simulado</span>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                        </button>
                    </div>
                </div>
            )}

            {/* === LOADING === */}
            {step === 'LOADING' && (
                <div className="flex flex-col items-center justify-center py-32 animate-in fade-in">
                    <div className="relative mb-8">
                        <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-primary">
                            <svg className="w-8 h-8 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
                        </div>
                    </div>
                    {/* Fixed Text Alignment for Mobile - Centered as requested */}
                    <div className="w-full text-center px-4">
                        <h2 className="text-xl font-bold text-foreground mb-2">{loadingText}</h2>
                        <p className="text-muted-foreground text-sm max-w-xs mx-auto">Estamos consultando seus flashcards e criando alternativas inteligentes.</p>
                    </div>
                </div>
            )}

            {/* ... RESTO DO CÓDIGO PERMANECE IGUAL, JÁ TEM SUPORTE A DARK MODE ... */}
            {/* === PROVA (EXAM) === */}
            {step === 'EXAM' && examCards.length > 0 && (
                <div className="max-w-3xl mx-auto animate-in slide-in-from-right-8 duration-500 select-none">
                    {/* ... */}
                    <div className="bg-card p-4 rounded-2xl shadow-sm border border-border flex justify-between items-center mb-6 sticky top-4 z-40">
                        <div className="flex items-center gap-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Progresso</span>
                                <div className="text-xl font-black text-foreground leading-none">
                                    {currentIndex + 1} <span className="text-muted-foreground text-base">/ {examCards.length}</span>
                                </div>
                            </div>
                            <div className="hidden sm:block h-2 w-32 bg-secondary rounded-full overflow-hidden">
                                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${((currentIndex) / examCards.length) * 100}%` }} />
                            </div>
                        </div>
                        {DIFFICULTIES[difficulty].timePerQuestion > 0 && (
                            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors duration-300 ${timeLeft <= 10 ? 'bg-destructive/10 border-destructive text-destructive animate-pulse' : 'bg-muted border-border text-muted-foreground'}`}>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                <span className="font-mono font-bold text-lg tabular-nums">00:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-card p-6 md:p-10 rounded-3xl shadow-lg border border-border mb-6 min-h-[180px] flex items-center justify-center text-center relative overflow-hidden group">
                        <div className="absolute inset-0 bg-linear-to-b from-transparent to-muted/50 pointer-events-none"></div>
                        <h2 className="text-2xl font-bold text-foreground leading-relaxed relative z-10">
                            {examCards[currentIndex].frente}
                        </h2>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                        {examCards[currentIndex].options.map((option: string, idx: number) => {
                            const letters = ["A", "B", "C", "D"];
                            const isSelected = selectedOption === option;
                            return (
                                <button
                                    key={idx}
                                    onClick={() => confirmAnswer(option)}
                                    className={`group relative p-5 rounded-2xl border-2 text-left transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] flex items-center gap-5
                                        ${isSelected
                                            ? "border-primary bg-primary/10 text-primary shadow-md"
                                            : "border-border bg-card hover:border-primary/50 hover:bg-muted text-muted-foreground"
                                        }
                                    `}
                                >
                                    <div className={`w-10 h-10 flex items-center justify-center rounded-xl text-sm font-bold transition-colors shrink-0 shadow-sm
                                        ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"}
                                    `}>
                                        {letters[idx]}
                                    </div>
                                    <span className="font-medium text-lg leading-snug">{option}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* === RESULTADO === */}
            {step === 'RESULT' && finalResult && (
                <div className="bg-card rounded-3xl shadow-2xl overflow-hidden border border-border animate-in zoom-in duration-300 max-w-lg mx-auto">
                    <div className={`p-10 text-center text-white relative overflow-hidden ${finalResult.score >= 0.7 ? "bg-emerald-600" : "bg-primary"}`}>
                            <div className="absolute top-0 left-0 w-full h-full opacity-20">
                            <svg className="w-full h-full" fill="currentColor" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M0 100 C 20 0 50 0 100 100 Z"></path></svg>
                            </div>

                        <div className="relative z-10">
                            <div className="text-7xl mb-4 filter drop-shadow-md">
                                {finalResult.score >= 0.9 ? "👑" : finalResult.score >= 0.7 ? "🎉" : "💪"}
                            </div>
                            <h2 className="text-3xl font-extrabold mb-1">Simulado Concluído!</h2>
                            <p className="opacity-90 font-medium">Desafio {DIFFICULTIES[difficulty].label} Finalizado</p>
                        </div>
                    </div>

                    <div className="p-8">
                        <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-muted p-5 rounded-2xl border border-border text-center">
                                <div className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">Acertos</div>
                                <div className="text-3xl font-black text-foreground">{finalResult.correctAnswers}<span className="text-muted-foreground text-xl">/{finalResult.totalQuestions}</span></div>
                            </div>

                            {/* LÓGICA DE EXIBIÇÃO DE XP LIMITADO */}
                            <div className={`p-5 rounded-2xl border text-center ${finalResult.limitReached ? 'bg-muted border-border opacity-70' : 'bg-primary/10 border-primary/20'}`}>
                                <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${finalResult.limitReached ? 'text-muted-foreground' : 'text-primary'}`}>
                                    {finalResult.limitReached ? "Limite Diário" : "XP Total"}
                                </div>
                                <div className={`text-3xl font-black ${finalResult.limitReached ? 'text-muted-foreground' : 'text-primary'}`}>
                                    {finalResult.limitReached ? "MAX" : `+${finalResult.xpGained}`}
                                </div>
                            </div>
                        </div>

                        {/* Mensagem explicativa se atingiu o limite */}
                        {finalResult.limitReached && (
                            <div className="mb-6 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-100 dark:border-yellow-800 rounded-xl text-xs text-yellow-700 dark:text-yellow-400 text-center">
                                Você atingiu o limite de 3 simulados valendo XP por dia. Continue praticando para fixar o conteúdo! 🧠
                            </div>
                        )}

                        <div className="space-y-3 mb-8">
                            <div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border">
                                <span className="text-sm font-medium text-muted-foreground">Tempo Total</span>
                                <span className="font-bold text-foreground">{Math.round(finalResult.totalTime)}s</span>
                            </div>
                            <div className="flex justify-between items-center p-4 bg-muted rounded-xl border border-border">
                                <span className="text-sm font-medium text-muted-foreground">Precisão</span>
                                <span className={`font-bold ${finalResult.score >= 0.7 ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}>{Math.round(finalResult.score * 100)}%</span>
                            </div>
                        </div>

                        <Link href="/colecao">
                            <button className="w-full py-4 bg-foreground text-background font-bold rounded-xl hover:opacity-90 transition shadow-lg flex justify-center items-center gap-2">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                                Voltar para Coleção
                            </button>
                        </Link>
                    </div>
                </div>
            )}
        </div>
    );
}
