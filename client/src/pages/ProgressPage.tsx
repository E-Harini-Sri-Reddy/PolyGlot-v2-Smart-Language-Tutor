import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getProgressDashboard } from "../services/dictionaryService";
import { ApiError } from "../services/api";

export function ProgressPage() {
  const [data, setData] = useState<Awaited<
    ReturnType<typeof getProgressDashboard>
  > | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const dashboard = await getProgressDashboard();
        setData(dashboard);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load progress.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return <p className="text-ink-soft">Loading your progress...</p>;
  }

  if (error || !data) {
    return (
      <div className="rounded-3xl border border-mist bg-white/85 p-8 text-center">
        <p className="font-display text-2xl text-ink">Your learning journey starts here</p>
        <p className="mt-2 text-sm text-coral">{error || "No progress yet."}</p>
        <Link to="/chat" className="mt-4 inline-block text-sea hover:underline">
          Start a conversation
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <h1 className="font-display text-3xl font-semibold text-ink">Progress</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Estimated CEFR {data.profile.estimatedCEFR} · Confidence{" "}
          {data.profile.conversationConfidence}/100
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Words learned", data.stats.wordsLearned],
            ["Words mastered", data.stats.wordsMastered],
            ["Quizzes taken", data.stats.quizzesTaken],
            ["Scenarios done", data.stats.scenariosCompleted],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl bg-foam px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-ink-soft">{label}</p>
              <p className="mt-1 font-display text-3xl text-ink">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <h2 className="font-display text-2xl text-ink">Skills</h2>
        <div className="mt-4 space-y-4">
          {data.skills.map((skill) => (
            <div key={skill.skill}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-ink">{skill.skill}</span>
                <span className="text-ink-soft">{skill.score}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-mist">
                <div
                  className="h-full rounded-full bg-sea"
                  style={{ width: `${skill.score}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <h3 className="font-display text-xl text-ink">Insights</h3>
          <p className="mt-3 text-sm text-ink-soft">
            Strongest: {data.strongestSkill?.skill || "—"} (
            {data.strongestSkill?.score ?? 0}%)
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Weakest: {data.weakestSkill?.skill || "—"} ({data.weakestSkill?.score ?? 0}%)
          </p>
          <p className="mt-3 rounded-2xl bg-sand px-3 py-3 text-sm text-ink">
            Recommended: {data.recommendedPractice}
          </p>
          {data.stats.averageQuizScore !== null && (
            <p className="mt-3 text-sm text-ink-soft">
              Average quiz score: {data.stats.averageQuizScore}%
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <h3 className="font-display text-xl text-ink">Quick actions</h3>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              to="/chat"
              className="rounded-xl bg-sea px-4 py-3 text-center font-semibold text-white"
            >
              Practice a scenario
            </Link>
            <Link
              to="/quiz"
              className="rounded-xl border border-mist bg-foam px-4 py-3 text-center font-semibold text-ink"
            >
              Take a quiz
            </Link>
            <Link
              to="/dictionary"
              className="rounded-xl border border-mist bg-foam px-4 py-3 text-center font-semibold text-ink"
            >
              Review dictionary ({data.stats.wordsNeedingReview} due)
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
