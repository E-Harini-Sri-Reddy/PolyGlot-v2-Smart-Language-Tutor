import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LEARNING_GOALS,
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  TUTOR_PERSONALITIES,
  type ProficiencyLevel,
  type SupportedLanguage,
  type TutorPersonality,
} from "../constants/languages";
import { getSettings, updateSettings, type UserSettings } from "../services/settingsService";
import { ApiError } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function SettingsPage() {
  const setSession = useAuthStore((s) => s.setSession);
  const accessToken = useAuthStore((s) => s.accessToken);
  const authUser = useAuthStore((s) => s.user);

  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getSettings()
      .then((data) => setSettings(data.settings))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Could not load settings."),
      );
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const data = await updateSettings({
        name: settings.name,
        pronouns: settings.pronouns,
        targetLanguage: settings.targetLanguage,
        level: settings.level,
        tutorPersonality: settings.tutorPersonality,
        dailyGoalMinutes: settings.dailyGoalMinutes,
        learningGoal: settings.learningGoal,
        showEnglishUnderReplies: settings.showEnglishUnderReplies,
      });
      setSettings(data.settings);
      if (accessToken && authUser) {
        setSession(accessToken, {
          ...authUser,
          name: data.settings.name || authUser.name,
          pronouns: data.settings.pronouns || "",
        });
      }
      setStatus("Settings saved. Polly will adapt on your next chat.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings && !error) {
    return <p className="text-ink-soft">Loading settings...</p>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl rounded-3xl border border-mist bg-white/85 p-8 shadow-sm"
    >
      <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Customize your profile, language, level, and Polly’s tutor personality.
      </p>

      {settings && (
        <div className="mt-6 space-y-4">
          <div className="rounded-2xl border border-sea/30 bg-sea/5 p-4">
            <p className="text-sm font-semibold text-ink">Chat display</p>
            <label className="mt-3 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 accent-sea"
                checked={Boolean(settings.showEnglishUnderReplies)}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    showEnglishUnderReplies: e.target.checked,
                  })
                }
              />
              <span>
                <span className="block font-medium text-ink">
                  Show English under Polly’s replies
                </span>
                <span className="mt-0.5 block text-xs text-ink-soft">
                  When enabled, replies show native script, romanization (when needed), then
                  an English translation underneath.
                </span>
              </span>
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Display name</span>
            <input
              value={settings.name || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  name: e.target.value,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
              placeholder="Your name"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Pronouns</span>
            <input
              value={settings.pronouns || ""}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  pronouns: e.target.value,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
              placeholder="e.g. she/her, he/him, they/them"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Target language</span>
            <select
              value={settings.targetLanguage}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  targetLanguage: e.target.value as SupportedLanguage,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Level</span>
            <select
              value={settings.level}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  level: e.target.value as ProficiencyLevel,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
            >
              {PROFICIENCY_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Tutor personality</span>
            <select
              value={settings.tutorPersonality}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  tutorPersonality: e.target.value as TutorPersonality,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
            >
              {TUTOR_PERSONALITIES.map((personality) => (
                <option key={personality} value={personality}>
                  {personality}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Daily goal (minutes)</span>
            <input
              type="number"
              min={5}
              max={120}
              value={settings.dailyGoalMinutes}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  dailyGoalMinutes: Number(e.target.value),
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-ink-soft">Learning goal</span>
            <select
              value={
                LEARNING_GOALS.includes(
                  settings.learningGoal as (typeof LEARNING_GOALS)[number],
                )
                  ? settings.learningGoal
                  : "Conversation"
              }
              onChange={(e) =>
                setSettings({
                  ...settings,
                  learningGoal: e.target.value,
                })
              }
              className="w-full rounded-xl border border-mist bg-foam px-3 py-2.5"
            >
              {LEARNING_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {goal}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-coral">{error}</p>}
      {status && <p className="mt-4 text-sm text-sea">{status}</p>}

      <button
        type="button"
        disabled={!settings || saving}
        onClick={() => void save()}
        className="mt-6 rounded-xl bg-sea px-5 py-3 font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving..." : "Save settings"}
      </button>
    </motion.div>
  );
}
