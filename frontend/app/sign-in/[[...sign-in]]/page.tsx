import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex h-dvh items-center justify-center overflow-hidden bg-background p-4">
      <SignIn />
    </main>
  );
}
