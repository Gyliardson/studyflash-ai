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
        <div className="group relative h-64 w-full perspective-[1000px] transition-all duration-300 hover:-translate-y-2">
            <button
                type="button"
                onClick={() => setIsFlipped((current) => !current)}
                aria-pressed={isFlipped}
                aria-label={`Cartão ${index + 1}: ${isFlipped ? "mostrar pergunta" : "mostrar resposta"}`}
                className="block h-full w-full rounded-2xl text-inherit focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                <span
                    className={`relative block h-full w-full transition-all duration-500 transform-3d ${isFlipped ? "transform-[rotateY(180deg)]" : ""}`}
                >
                    <span className="absolute inset-0 flex h-full w-full flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-8 text-center shadow-xl backface-hidden transition-all duration-300 group-hover:border-primary/50 group-hover:shadow-2xl">
                        <span className="absolute left-4 top-4 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                            Cartão {index + 1}
                        </span>
                        <span className="mt-2 text-xl font-bold text-card-foreground">{frente}</span>
                        <span className="absolute bottom-4 text-xs text-muted-foreground transition-colors group-hover:text-primary">
                            Clique ou pressione Enter para ver a resposta
                        </span>
                    </span>

                    <span className="absolute inset-0 flex h-full w-full transform-[rotateY(180deg)] flex-col items-center justify-center rounded-2xl bg-linear-to-br from-blue-600 to-blue-800 p-8 text-center text-white shadow-xl backface-hidden transition-all duration-300 group-hover:brightness-110 group-hover:shadow-2xl dark:from-blue-700 dark:to-blue-900">
                        <span className="absolute left-4 top-4 text-xs font-bold uppercase tracking-widest text-blue-200">
                            Resposta
                        </span>
                        <span className="text-lg font-medium leading-relaxed">{verso}</span>
                        <span className="absolute bottom-4 text-xs text-blue-200">
                            Clique ou pressione Enter para voltar
                        </span>
                    </span>
                </span>
            </button>

            {onDelete && (
                <button
                    type="button"
                    onClick={onDelete}
                    aria-label={`Excluir cartão ${index + 1}`}
                    className="absolute right-4 top-4 z-20 rounded-full p-2 text-muted-foreground opacity-0 shadow-sm transition-all duration-300 hover:scale-110 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    title="Excluir Flashcard"
                >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            )}
        </div>
    );
}
