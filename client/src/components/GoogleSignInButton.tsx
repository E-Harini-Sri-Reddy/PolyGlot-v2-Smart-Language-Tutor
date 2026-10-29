import { useEffect, useRef } from "react";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../services/api";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: Record<string, string | number>,
          ) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({
  onError,
  onPendingDeletion,
}: {
  onError: (message: string) => void;
  onPendingDeletion?: (info: { purgeAt: string; idToken: string }) => void;
}) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const googleLogin = useAuthStore((s) => s.googleLogin);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!clientId || !buttonRef.current) return;

    let cancelled = false;

    const tryRender = () => {
      if (cancelled || !window.google || !buttonRef.current) return false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response) => {
          try {
            await googleLogin(response.credential);
          } catch (error) {
            if (
              error instanceof ApiError &&
              error.code === "ACCOUNT_PENDING_DELETION" &&
              onPendingDeletion
            ) {
              onPendingDeletion({
                purgeAt:
                  typeof error.details.purgeAt === "string" ? error.details.purgeAt : "",
                idToken: response.credential,
              });
              return;
            }
            onError(
              error instanceof Error
                ? error.message
                : "Google sign-in failed.",
            );
          }
        },
      });
      buttonRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
      });
      return true;
    };

    if (!tryRender()) {
      const id = window.setInterval(() => {
        if (tryRender()) window.clearInterval(id);
      }, 300);
      return () => {
        cancelled = true;
        window.clearInterval(id);
      };
    }

    return () => {
      cancelled = true;
    };
  }, [clientId, googleLogin, onError, onPendingDeletion]);

  if (!clientId) {
    return (
      <p className="rounded-xl bg-sand px-3 py-2 text-center text-xs text-ink-soft">
        Google sign-in will appear once VITE_GOOGLE_CLIENT_ID is set.
      </p>
    );
  }

  return <div ref={buttonRef} className="flex justify-center" />;
}
