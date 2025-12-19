import InstallPrompt from "@/app/components/InstallPrompt";
import Header from "@/app/components/Header";
import Link from "next/link";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <InstallPrompt />
      <Header />
      <div className="flex-1 min-h-[calc(100vh-200px)]">
          {children}
      </div>
      <footer className="py-6 border-t border-border mt-12 bg-card/50">
          <div className="container mx-auto px-4 text-center text-sm text-muted-foreground flex justify-center gap-6">
              <span>StudyFlash © {new Date().getFullYear()}</span>
              <Link href="/termos" className="hover:text-primary transition-colors">Termos</Link>
              <Link href="/privacidade" className="hover:text-primary transition-colors">Privacidade</Link>
          </div>
      </footer>
    </>
  );
}
