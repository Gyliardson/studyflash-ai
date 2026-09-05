import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="fixed inset-0 flex items-center justify-center overflow-hidden bg-background p-4">
      <SignIn />
    </main>
  );
}
