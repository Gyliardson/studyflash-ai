"use client";
import { useState } from "react";

interface FlashcardProps {
    frente: string;
    verso: string;
    index: number;
}

export default function Flashcard({ frente, verso, index }: FlashcardProps) {
    const [isFlipped, setIsFlipped] = useState(false);

    return (
        <div
            className="group h-64 w-full [perspective:1000px] cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
        >
            <div
                className={`relative h-full w-full transition-all duration-500 [transform-style:preserve-3d] ${isFlipped ? "[transform:rotateY(180deg)]" : ""
                    }`}
            >
                {/* --- FRENTE DO CARTÃO --- */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-white p-8 shadow-xl border-2 border-blue-100 flex flex-col items-center justify-center text-center [backface-visibility:hidden]">
                    <span className="absolute top-4 left-4 text-xs font-bold text-blue-400 uppercase tracking-widest">
                        Cartão {index + 1}
                    </span>
                    <p className="text-xl font-bold text-gray-800">{frente}</p>
                    <p className="absolute bottom-4 text-xs text-gray-400">
                        Clique para ver a resposta
                    </p>
                </div>

                {/* --- VERSO DO CARTÃO (A Resposta) --- */}
                <div className="absolute inset-0 h-full w-full rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 p-8 text-white shadow-xl [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col items-center justify-center text-center">
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