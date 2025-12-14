"use client";

import { Suspense } from "react";
import Header from "../components/Header";
import SimuladoContent from "./SimuladoContent";

export default function SimuladoPage() {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-slate-950 flex flex-col items-center select-none transition-colors duration-300" onContextMenu={(e) => e.preventDefault()}>
            <Header />
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-32 animate-in fade-in">
                    <div className="w-16 h-16 border-4 border-indigo-200 dark:border-indigo-800 border-t-indigo-600 dark:border-t-indigo-500 rounded-full animate-spin mb-6"></div>
                    <h2 className="text-xl font-bold text-gray-700 dark:text-gray-200">Carregando ambiente...</h2>
                </div>
            }>
                <SimuladoContent />
            </Suspense>
        </div>
    );
}
