import { Link } from "react-router-dom";
import type { ReactNode } from "react";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <div className="text-center">
          <Link to="/" className="font-display text-4xl font-bold tracking-tight text-ink">
            PolyGlot AI
          </Link>
          <p className="mt-2 text-ink-soft">Practice with Polly, your personal language tutor.</p>
        </div>

        <div className="rounded-3xl border border-mist bg-white/80 p-8 shadow-[0_20px_60px_rgba(16,42,67,0.08)] backdrop-blur">
          <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
          <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
