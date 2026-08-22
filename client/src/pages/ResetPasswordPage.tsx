import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "../layouts/AuthLayout";
import { apiFetch, ApiError } from "../services/api";

const schema = z.object({
  password: z.string().min(8, "Use at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
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
      const data = await apiFetch<{ message: string }>("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password: values.password }),
      });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset password.");
    }
  });

  return (
    <AuthLayout title="Choose a new password" subtitle="Set a new password for your account.">
      {!token ? (
        <p className="text-sm text-coral">This reset link is missing or invalid.</p>
      ) : (
        <form className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink">New password</label>
            <input
              type="password"
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-sea focus:ring-2"
              {...register("password")}
            />
            {errors.password && (
              <p className="mt-1 text-xs text-coral">{errors.password.message}</p>
            )}
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}
          {message && <p className="text-sm text-sea">{message}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-sea px-4 py-3 font-semibold text-white transition hover:bg-sea-deep disabled:opacity-60"
          >
            {isSubmitting ? "Updating..." : "Update password"}
          </button>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-ink-soft">
        <Link className="text-sea hover:underline" to="/login">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
