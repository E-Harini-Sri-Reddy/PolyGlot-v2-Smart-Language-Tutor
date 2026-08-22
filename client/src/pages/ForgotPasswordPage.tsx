import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "../layouts/AuthLayout";
import { apiFetch, ApiError } from "../services/api";

const schema = z.object({
  email: z.email(),
});

type FormValues = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setMessage(null);
    try {
      const data = await apiFetch<{ message: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify(values),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send reset email.");
    }
  });

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="We'll email you a reset link if that account exists."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Email</label>
          <input
            type="email"
            className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-sea focus:ring-2"
            {...register("email")}
          />
          {errors.email && (
            <p className="mt-1 text-xs text-coral">{errors.email.message}</p>
          )}
        </div>

        {error && <p className="text-sm text-coral">{error}</p>}
        {message && <p className="text-sm text-sea">{message}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-sea px-4 py-3 font-semibold text-white transition hover:bg-sea-deep disabled:opacity-60"
        >
          {isSubmitting ? "Sending..." : "Send reset link"}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-ink-soft">
        <Link className="text-sea hover:underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
