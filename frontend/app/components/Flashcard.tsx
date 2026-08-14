"use client";
import { useState } from "react";

interface FlashcardProps {
    frente: string;
    verso: string;
    index: number;
    onDelete?: () => void;
}

export default function Flashcard({ frente, verso, index, onDelete }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div
            className="group h-64 w-full perspective-[1000px] cursor-pointer transition-all duration-300 hover:-translate-y-2"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className={`relative h-full w-full transition-all duration-500 transform-3d ${isFlipped ? "transform-[rotateY(180deg)]" : ""
                    }`}
            >
                {/* --- FRENTE DO CARTÃO --- */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-card p-8 shadow-xl border-2 border-border flex flex-col items-center justify-center text-center backface-hidden transition-all duration-300 group-hover:shadow-2xl group-hover:border-primary/50">

                    {/* CABEÇALHO DO CARD (Número + Lixeira) */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                            Cartão {index + 1}
                        </span>

                        {/* LIXEIRA */}
                        {onDelete && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete();
                                }}
                                aria-label={`Excluir cartão ${index + 1}`}
                                className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 hover:scale-125 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                title="Excluir Flashcard"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                        )}
                    </div>

                    <p className="text-xl font-bold text-card-foreground mt-2">{frente}</p>
                    <p className="absolute bottom-4 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                        Clique para ver a resposta
                    </p>
                </div>

                {/* --- VERSO DO CARTÃO --- */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-linear-to-br from-blue-600 to-blue-800 dark:from-blue-700 dark:to-blue-900 p-8 text-white shadow-xl transform-[rotateY(180deg)] backface-hidden flex flex-col items-center justify-center text-center transition-all duration-300 group-hover:shadow-2xl group-hover:brightness-110">
                    <span className="absolute top-4 left-4 text-xs font-bold text-blue-200 uppercase tracking-widest">
                        Resposta
                    </span>
                    <p className="text-lg font-medium leading-relaxed">{verso}</p>
                    <p className="absolute bottom-4 text-xs text-blue-200">
                        Clique para voltar
                    </p>
                </div>
            </div>
        </div>
    );
}
