import type { Metadata } from "next";
import { Suspense } from "react";
import { safeCallbackUrl } from "@/lib/auth/callback-url";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

async function Form({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { callbackUrl } = await searchParams;
  return <LoginForm callbackUrl={safeCallbackUrl(typeof callbackUrl === "string" ? callbackUrl : undefined)} />;
}

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main
      className="flex flex-1 items-center justify-center bg-cover bg-center p-4"
      style={{ backgroundImage: "url('/bg.jpg')" }}
    >
      <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-semibold text-secondary">Fibatron</h1>
        <Suspense fallback={null}>
          <Form searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
