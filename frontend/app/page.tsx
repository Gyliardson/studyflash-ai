"use client";

import { useState } from "react";
// IMPORTANTE: Importando o componente novo
import Flashcard from "./components/Flashcard";

export default function Home() {
    const [texto, setTexto] = useState("");
    const [flashcards, setFlashcards] = useState([]);
    const [loading, setLoading] = useState(false);

    async function gerarFlashcards() {
        if (!texto.trim()) return alert("Digite um texto para estudar!");

        setLoading(true);
        try {
            const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

            const response = await fetch(`${baseUrl}/api/gerar`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ texto }),
            });

            const data = await response.json();
            setFlashcards(data.cartoes);
        } catch (error) {
            alert("Erro ao conectar.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center p-6 md:p-12">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-teal-500 mb-8">
                StudyFlash AI ⚡
            </h1>

            {/* Área de Input */}
            <div className="w-full max-w-3xl bg-white p-6 rounded-2xl shadow-xl border border-gray-100 mb-10">
                <textarea
                    className="w-full h-32 p-4 border border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none resize-none text-gray-700 transition-all"
                    placeholder="Cole seu texto de estudo aqui..."
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                />
                <button
                    onClick={gerarFlashcards}
                    disabled={loading}
                    className={`w-full mt-4 py-3 rounded-xl font-bold text-white transition-all transform active:scale-95 ${loading
                            ? "bg-gray-400 cursor-wait"
                            : "bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/30"
                        }`}
                >
                    {loading ? "Criando Flashcards..." : "Gerar Flashcards ✨"}
                </button>
            </div>

            {/* GRID DE FLASHCARDS */}
            {/* Aqui usamos CSS Grid para ficar bonito no celular e no PC */}
            <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {flashcards.map((card: any, index) => (
                    <Flashcard
                        key={index}
                        index={index}
                        frente={card.frente}
                        verso={card.verso}
                    />
                ))}
            </div>
        </div>
    );
}