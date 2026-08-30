import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { getProgressDashboard } from "../services/dictionaryService";
import { getWeeklyInsights } from "../services/settingsService";
import { useAuthStore } from "../store/authStore";
import { ApiError } from "../services/api";

export function HomePage() {
  const user = useAuthStore((s) => s.user);
  const [dashboard, setDashboard] = useState<Awaited<
    ReturnType<typeof getProgressDashboard>
  > | null>(null);
  const [insights, setInsights] = useState<
    Awaited<ReturnType<typeof getWeeklyInsights>>["insights"] | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [dash, weekly] = await Promise.all([
          getProgressDashboard(),
          getWeeklyInsights(),
        ]);
        setDashboard(dash);
        setInsights(weekly.insights);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load home.");
      }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-mist bg-white/85 p-8 shadow-sm"
      >
        <p className="font-display text-4xl font-bold text-ink">PolyGlot AI</p>
        <p className="mt-2 text-ink-soft">
          Welcome back{user?.name ? `, ${user.name}` : ""}. Polly is ready when you are.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/chat"
            className="rounded-xl bg-sea px-5 py-3 font-semibold text-white"
          >
            Continue learning
          </Link>
          <Link
            to="/quiz"
            className="rounded-xl border border-mist bg-foam px-5 py-3 font-semibold text-ink"
          >
            Take a quiz
          </Link>
        </div>
      </motion.section>

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm"
        >
          <h2 className="font-display text-xl text-ink">Today’s goal</h2>
          <p className="mt-2 text-3xl font-semibold text-sea">
            {dashboard?.stats.dailyGoalMinutes || 15} min
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            CEFR {dashboard?.profile.estimatedCEFR || "A1"} · Confidence{" "}
            {dashboard?.profile.conversationConfidence ?? 40}
          </p>
        </motion.section>

        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm lg:col-span-2"
        >
          <h2 className="font-display text-xl text-ink">Recommended practice</h2>
          <p className="mt-2 text-ink">
            {dashboard?.recommendedPractice || "Start a conversation with Polly"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Suggested scenario: {dashboard?.recommendedScenario || "Coffee Shop"}
          </p>
          <Link to="/chat" className="mt-4 inline-block text-sm font-medium text-sea">
            Open chat →
          </Link>
        </motion.section>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm"
      >
        <h2 className="font-display text-xl text-ink">This week</h2>
        {insights ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl bg-foam px-4 py-3">
              <p className="text-xs uppercase text-ink-soft">Words learned</p>
              <p className="font-display text-3xl text-ink">{insights.wordsLearned}</p>
            </div>
            <div className="rounded-2xl bg-foam px-4 py-3">
              <p className="text-xs uppercase text-ink-soft">Conversation mins</p>
              <p className="font-display text-3xl text-ink">
                {insights.conversationMinutes}
              </p>
            </div>
            <div className="rounded-2xl bg-foam px-4 py-3">
              <p className="text-xs uppercase text-ink-soft">Improved</p>
              <p className="mt-1 text-sm font-medium text-ink">{insights.improved}</p>
            </div>
            <div className="rounded-2xl bg-foam px-4 py-3">
              <p className="text-xs uppercase text-ink-soft">Needs work</p>
              <p className="mt-1 text-sm font-medium text-ink">
                {insights.needsImprovement}
              </p>
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-ink-soft">Loading weekly insights...</p>
        )}
        {insights && (
          <p className="mt-4 rounded-2xl bg-sand px-4 py-3 text-sm text-ink">
            {insights.encouragement}
          </p>
        )}
      </motion.section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <h2 className="font-display text-xl text-ink">Last conversation</h2>
          {dashboard?.recentConversations?.[0] ? (
            <div className="mt-3">
              <p className="font-medium text-ink">
                {dashboard.recentConversations[0].title}
              </p>
              <p className="text-sm text-ink-soft">
                {dashboard.recentConversations[0].language} ·{" "}
                {dashboard.recentConversations[0].level}
              </p>
              <Link to="/chat" className="mt-3 inline-block text-sm text-sea">
                Resume in chat →
              </Link>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">No conversations yet.</p>
          )}
        </section>

        <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <h2 className="font-display text-xl text-ink">Recent vocabulary</h2>
          {dashboard?.recentVocabulary?.length ? (
            <ul className="mt-3 space-y-2">
              {dashboard.recentVocabulary.map((entry) => (
                <li
                  key={entry._id}
                  className="flex justify-between rounded-xl bg-foam px-3 py-2 text-sm"
                >
                  <span className="font-medium text-ink">{entry.word}</span>
                  <span className="text-ink-soft">{entry.masteryScore}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-ink-soft">
              Save words while chatting to build your dictionary.
            </p>
          )}
          <Link to="/dictionary" className="mt-3 inline-block text-sm text-sea">
            Open dictionary →
          </Link>
        </section>
      </div>
    </div>
  );
}
