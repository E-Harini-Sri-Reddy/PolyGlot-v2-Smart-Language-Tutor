import { useEffect, useMemo, useState } from "react";
import {
  PROFICIENCY_LEVELS,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../constants/languages";
import {
  generateQuiz,
  listQuizzes,
  retakeQuiz,
  submitQuiz,
  type GeneratedQuiz,
} from "../services/quizService";
import { ApiError } from "../services/api";

export function QuizPage() {
  const [language, setLanguage] = useState<SupportedLanguage>("Spanish");
  const [quiz, setQuiz] = useState<GeneratedQuiz | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [results, setResults] = useState<Array<{
    prompt: string;
    expected: string;
    userAnswer: string;
    correct: boolean;
    explanation?: string;
  }> | null>(null);
  const [percent, setPercent] = useState<number | null>(null);
  const [lastQuizId, setLastQuizId] = useState<string | null>(null);
  const [history, setHistory] = useState<
    Array<{ _id: string; topic: string; score: number; total: number; status: string }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void listQuizzes()
      .then((data) => setHistory(data.quizzes))
      .catch(() => undefined);
  }, [results, quiz]);

  const canSubmit = useMemo(
    () => Boolean(quiz && answers.every((answer) => answer.trim().length > 0)),
    [quiz, answers],
  );

  function startQuiz(data: GeneratedQuiz) {
    setQuiz(data);
    setLastQuizId(data.id);
    setAnswers(data.questions.map(() => ""));
    setResults(null);
    setPercent(null);
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setResults(null);
    setPercent(null);
    try {
      const data = await generateQuiz(language, 5);
      startQuiz(data.quiz);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not generate quiz. Save more dictionary words first.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleRetake(quizId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await retakeQuiz(quizId);
      startQuiz(data.quiz);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not retake quiz.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!quiz) return;
    setLoading(true);
    setError(null);
    try {
      const data = await submitQuiz(quiz.id, answers);
      setLastQuizId(quiz.id);
      setResults(data.results);
      setPercent(data.percent);
      setQuiz(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit quiz.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <h1 className="font-display text-3xl font-semibold text-ink">Quizzes</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Practice with questions built from your dictionary, weak grammar, and recent learning.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-ink-soft">Language</span>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as SupportedLanguage)}
              className="rounded-xl border border-mist bg-foam px-3 py-2.5"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang} value={lang}>
                  {lang}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleGenerate()}
            className="rounded-xl bg-sea px-5 py-2.5 font-semibold text-white hover:bg-sea-deep disabled:opacity-60"
          >
            {loading ? "Working..." : "Generate quiz"}
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-coral">{error}</p>}
      </section>

      {quiz && (
        <section className="space-y-4 rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <div>
            <h2 className="font-display text-2xl text-ink">{quiz.topic}</h2>
            <p className="text-sm text-ink-soft">{quiz.total} questions</p>
          </div>

          {quiz.questions.map((question, index) => (
            <div key={`${question.prompt}-${index}`} className="rounded-2xl bg-foam/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {question.type.replaceAll("_", " ")}
              </p>
              <p className="mt-1 whitespace-pre-line font-medium text-ink">{question.prompt}</p>
              {question.options && question.options.length > 0 ? (
                <div className="mt-3 space-y-2">
                  {question.options.map((option) => (
                    <label
                      key={option}
                      className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm"
                    >
                      <input
                        type="radio"
                        name={`q-${index}`}
                        checked={answers[index] === option}
                        onChange={() =>
                          setAnswers((prev) => {
                            const next = [...prev];
                            next[index] = option;
                            return next;
                          })
                        }
                      />
                      {option}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  value={answers[index] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => {
                      const next = [...prev];
                      next[index] = e.target.value;
                      return next;
                    })
                  }
                  className="mt-3 w-full rounded-xl border border-mist bg-white px-3 py-2.5"
                  placeholder="Type your answer"
                />
              )}
            </div>
          ))}

          <button
            type="button"
            disabled={!canSubmit || loading}
            onClick={() => void handleSubmit()}
            className="rounded-xl bg-coral px-5 py-3 font-semibold text-white disabled:opacity-50"
          >
            Submit quiz
          </button>
        </section>
      )}

      {results && (
        <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-2xl text-ink">Results</h2>
              <p className="mt-1 text-sea">Score: {percent}%</p>
            </div>
            {lastQuizId && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void handleRetake(lastQuizId)}
                className="rounded-xl bg-sea px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                Retake this quiz
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {results.map((result, index) => (
              <div
                key={`${result.prompt}-${index}`}
                className={`rounded-2xl px-4 py-3 text-sm ${
                  result.correct ? "bg-sea/10" : "bg-coral/10"
                }`}
              >
                <p className="whitespace-pre-line font-medium text-ink">{result.prompt}</p>
                <p className="mt-1 text-ink-soft">Your answer: {result.userAnswer || "(blank)"}</p>
                {result.correct ? (
                  <p className="mt-1 text-sea">Marked correct</p>
                ) : (
                  <p className="text-ink-soft">Reference: {result.expected}</p>
                )}
                {result.explanation && (
                  <p className="mt-1 text-ink">{result.explanation}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <h2 className="font-display text-xl text-ink">Recent quizzes</h2>
        {history.length === 0 ? (
          <p className="mt-3 text-sm text-ink-soft">No quizzes yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {history.map((item) => (
              <li
                key={item._id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foam px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-ink">{item.topic}</span>
                  <span className="ml-2 text-ink-soft">
                    {item.status === "completed"
                      ? `${item.score}/${item.total}`
                      : "In progress"}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void handleRetake(item._id)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-sea hover:bg-sea/10 disabled:opacity-60"
                >
                  Retake
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-ink-soft">
          Levels available: {PROFICIENCY_LEVELS.join(", ")}
        </p>
      </section>
    </div>
  );
}
