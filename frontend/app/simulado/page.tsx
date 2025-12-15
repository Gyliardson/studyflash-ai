"use client";

import { Suspense } from "react";
import Header from "../components/Header";
import SimuladoContent from "./SimuladoContent";

export default function SimuladoPage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center select-none transition-colors duration-300" onContextMenu={(e) => e.preventDefault()}>
            <Header />
            <Suspense fallback={
                <div className="flex flex-col items-center justify-center py-32 animate-in fade-in">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mb-6"></div>
                    <h2 className="text-xl font-bold text-foreground">Carregando ambiente...</h2>
                </div>
            }>
                <SimuladoContent />
            </Suspense>
        </div>
    );
}
