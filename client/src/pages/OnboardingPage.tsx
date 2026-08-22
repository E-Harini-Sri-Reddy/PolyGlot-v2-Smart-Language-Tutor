import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  LEARNING_GOALS,
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  TOPIC_OPTIONS,
  TUTOR_PERSONALITIES,
  type ProficiencyLevel,
  type SupportedLanguage,
  type TutorPersonality,
} from "../constants/languages";
import { completeOnboarding } from "../services/settingsService";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../services/api";

const steps = ["Language", "Level", "Goal", "Daily time", "Tutor", "Topics"] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    targetLanguage: "Spanish" as SupportedLanguage,
    level: "Beginner" as ProficiencyLevel,
    learningGoal: "Conversation",
    dailyGoalMinutes: 15,
    tutorPersonality: "Friendly Teacher" as TutorPersonality,
    preferredTopics: [] as string[],
  });

  function toggleTopic(topic: string) {
    setForm((prev) => ({
      ...prev,
      preferredTopics: prev.preferredTopics.includes(topic)
        ? prev.preferredTopics.filter((item) => item !== topic)
        : [...prev.preferredTopics, topic].slice(0, 6),
    }));
  }

  async function finish() {
    setSaving(true);
    setError(null);
    try {
      const data = await completeOnboarding(form);
      if (accessToken) {
        setSession(accessToken, data.user);
      }
      navigate("/home", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save onboarding.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col justify-center px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-mist bg-white/90 p-8 shadow-sm"
      >
        <p className="font-display text-3xl font-bold text-ink">PolyGlot AI</p>
        <p className="mt-1 text-sm text-ink-soft">
          Meet Polly — let’s personalize your learning path.
        </p>

        <div className="mt-5 flex gap-1">
          {steps.map((label, index) => (
            <div
              key={label}
              className={`h-1.5 flex-1 rounded-full ${
                index <= step ? "bg-sea" : "bg-mist"
              }`}
            />
          ))}
        </div>
        <p className="mt-2 text-xs uppercase tracking-wide text-ink-soft">
          Step {step + 1}: {steps[step]}
        </p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="mt-6"
          >
            {step === 0 && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SUPPORTED_LANGUAGES.filter((lang) => lang !== "English").map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, targetLanguage: lang }))}
                    className={`rounded-xl px-3 py-3 text-sm font-medium ${
                      form.targetLanguage === lang
                        ? "bg-sea text-white"
                        : "bg-foam text-ink"
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <div className="space-y-2">
                {PROFICIENCY_LEVELS.map((level) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, level }))}
                    className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${
                      form.level === level ? "bg-sea text-white" : "bg-foam text-ink"
                    }`}
                  >
                    {level}
                  </button>
                ))}
              </div>
            )}

            {step === 2 && (
              <div className="grid grid-cols-2 gap-2">
                {LEARNING_GOALS.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, learningGoal: goal }))}
                    className={`rounded-xl px-3 py-3 text-sm font-medium ${
                      form.learningGoal === goal
                        ? "bg-sea text-white"
                        : "bg-foam text-ink"
                    }`}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="grid grid-cols-2 gap-2">
                {[5, 10, 15, 30].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, dailyGoalMinutes: minutes }))
                    }
                    className={`rounded-xl px-3 py-3 text-sm font-medium ${
                      form.dailyGoalMinutes === minutes
                        ? "bg-sea text-white"
                        : "bg-foam text-ink"
                    }`}
                  >
                    {minutes} minutes
                  </button>
                ))}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-2">
                {TUTOR_PERSONALITIES.map((personality) => (
                  <button
                    key={personality}
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, tutorPersonality: personality }))
                    }
                    className={`w-full rounded-xl px-4 py-3 text-left text-sm font-medium ${
                      form.tutorPersonality === personality
                        ? "bg-sea text-white"
                        : "bg-foam text-ink"
                    }`}
                  >
                    {personality}
                  </button>
                ))}
              </div>
            )}

            {step === 5 && (
              <div className="grid grid-cols-2 gap-2">
                {TOPIC_OPTIONS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => toggleTopic(topic)}
                    className={`rounded-xl px-3 py-3 text-sm font-medium ${
                      form.preferredTopics.includes(topic)
                        ? "bg-coral text-white"
                        : "bg-foam text-ink"
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-sm text-coral">{error}</p>}

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            disabled={step === 0}
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            className="rounded-xl border border-mist px-4 py-2.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            Back
          </button>
          {step < steps.length - 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              className="rounded-xl bg-sea px-5 py-2.5 text-sm font-semibold text-white"
            >
              Continue
            </button>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() => void finish()}
              className="rounded-xl bg-coral px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Saving..." : "Meet Polly"}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}
