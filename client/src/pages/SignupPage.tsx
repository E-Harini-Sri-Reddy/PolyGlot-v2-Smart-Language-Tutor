import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { AuthLayout } from "../layouts/AuthLayout";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../services/api";

const schema = z.object({
  name: z.string().min(2, "Name is required"),
  email: z.email(),
  password: z.string().min(8, "Use at least 8 characters"),
});

type FormValues = z.infer<typeof schema>;

export function SignupPage() {
  const user = useAuthStore((s) => s.user);
  const registerUser = useAuthStore((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (user) return <Navigate to="/home" replace />;

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await registerUser(values.name, values.email, values.password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account.");
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Join PolyGlot AI and start learning with Polly."
    >
      <form className="space-y-4" onSubmit={onSubmit}>
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Name</label>
          <input
            className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5 outline-none ring-sea focus:ring-2"
            {...register("name")}
          />
          {errors.name && <p className="mt-1 text-xs text-coral">{errors.name.message}</p>}
        </div>
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
        <div>
          <label className="mb-1 block text-sm font-medium text-ink">Password</label>
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

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-xl bg-sea px-4 py-3 font-semibold text-white transition hover:bg-sea-deep disabled:opacity-60"
        >
          {isSubmitting ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-soft">
        <div className="h-px flex-1 bg-mist" />
        or
        <div className="h-px flex-1 bg-mist" />
      </div>

      <GoogleSignInButton onError={setError} />

      <p className="mt-5 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link className="font-medium text-sea hover:underline" to="/login">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
