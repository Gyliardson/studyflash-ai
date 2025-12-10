"use client";
import { useState } from "react";

interface FlashcardProps {
    frente: string;
    verso: string;
    index: number;
    onDelete?: () => void; // Nova propriedade opcional
}

export default function Flashcard({ frente, verso, index, onDelete }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    // Função para não virar o card quando clicar na lixeira
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation(); // Impede o clique de passar para o card
        if (confirm("Tem certeza que deseja excluir este cartão?")) {
            if (onDelete) onDelete();
        }
    };

    return (
        <div
            className="group h-64 w-full [perspective:1000px] cursor-pointer relative"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            {/* Botão de Excluir (Só aparece se onDelete existir) */}
            {onDelete && (
                <button
                    onClick={handleDelete}
                    className="absolute top-2 right-2 z-10 p-2 bg-red-100 text-red-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white shadow-sm"
                    title="Excluir cartão"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            )}

            <div
                className={`relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
            >
                {/* FRENTE */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-white p-8 shadow-xl border-2 border-blue-100 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
                    <span className="absolute top-4 left-4 text-xs font-bold text-blue-400 uppercase tracking-widest">
                        Cartão {index + 1}
                    </span>
                    <p className="text-xl font-bold text-gray-800">{frente}</p>
                    <p className="absolute bottom-4 text-xs text-gray-400">Clique para ver a resposta</p>
                </div>

                {/* VERSO */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white shadow-xl [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col items-center justify-center text-center">
                    <span className="absolute top-4 left-4 text-xs font-bold text-blue-200 uppercase tracking-widest">
                        Resposta
                    </span>
                    <p className="text-lg font-medium leading-relaxed">{verso}</p>
                </div>
            </div>
        </div>
    );
}