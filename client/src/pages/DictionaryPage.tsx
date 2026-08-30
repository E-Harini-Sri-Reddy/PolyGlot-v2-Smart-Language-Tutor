import { useEffect, useMemo, useState } from "react";
import { BookMarked, Heart, Search, Trash2 } from "lucide-react";
import {
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from "../constants/languages";
import {
  addDictionaryWord,
  deleteDictionaryWord,
  getLearningProfile,
  listDictionary,
  reviewDictionaryWord,
  updateDictionaryWord,
  type DictionaryEntry,
  type LearningProfile,
} from "../services/dictionaryService";
import { ApiError } from "../services/api";

export function DictionaryPage() {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [profile, setProfile] = useState<LearningProfile | null>(null);
  const [language, setLanguage] = useState<SupportedLanguage | "all">("all");
  const [search, setSearch] = useState("");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const [draft, setDraft] = useState({
    word: "",
    meaning: "",
    pronunciation: "",
    language: "Spanish" as SupportedLanguage,
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [dict, dna] = await Promise.all([
        listDictionary({
          language: language === "all" ? undefined : language,
          favorite: favoriteOnly || undefined,
          needsReview: needsReview || undefined,
          search: search.trim() || undefined,
        }),
        getLearningProfile(),
      ]);
      setEntries(dict.entries);
      setProfile(dna.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load dictionary.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [language, favoriteOnly, needsReview]);

  const filteredCount = useMemo(() => entries.length, [entries]);

  async function handleSearchSubmit(event: React.FormEvent) {
    event.preventDefault();
    await load();
  }

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    setStatus(null);
    try {
      await addDictionaryWord({
        word: draft.word,
        meaning: draft.meaning,
        pronunciation: draft.pronunciation || undefined,
        language: draft.language,
      });
      setDraft({ word: "", meaning: "", pronunciation: "", language: draft.language });
      setStatus("Word saved to your dictionary.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save word.");
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold text-ink">Dictionary</h1>
            <p className="mt-1 text-sm text-ink-soft">
              Words Polly helps you learn — saved from explanations and manual adds.
            </p>
          </div>
          {profile && (
            <div className="rounded-2xl bg-sand px-4 py-3 text-sm text-ink-soft">
              <p className="font-medium text-ink">Learning DNA</p>
              <p>
                CEFR {profile.estimatedCEFR} · Confidence {profile.conversationConfidence}
              </p>
              <p className="mt-1">
                Weak spots: {profile.weaknesses.slice(0, 3).join(", ") || "still learning"}
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleAdd} className="mt-5 grid gap-3 md:grid-cols-4">
          <input
            value={draft.word}
            onChange={(e) => setDraft((d) => ({ ...d, word: e.target.value }))}
            placeholder="Word"
            className="rounded-xl border border-mist bg-foam px-3 py-2.5"
            required
          />
          <input
            value={draft.meaning}
            onChange={(e) => setDraft((d) => ({ ...d, meaning: e.target.value }))}
            placeholder="Meaning"
            className="rounded-xl border border-mist bg-foam px-3 py-2.5"
            required
          />
          <select
            value={draft.language}
            onChange={(e) =>
              setDraft((d) => ({ ...d, language: e.target.value as SupportedLanguage }))
            }
            className="rounded-xl border border-mist bg-foam px-3 py-2.5"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-sea px-4 py-2.5 font-semibold text-white hover:bg-sea-deep"
          >
            Save word
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-mist bg-white/85 p-6 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search words or meanings"
              className="w-full rounded-xl border border-mist bg-foam py-2.5 pl-9 pr-3"
            />
          </div>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as SupportedLanguage | "all")}
            className="rounded-xl border border-mist bg-foam px-3 py-2.5"
          >
            <option value="all">All languages</option>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={favoriteOnly}
              onChange={(e) => setFavoriteOnly(e.target.checked)}
            />
            Favorites
          </label>
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
            <input
              type="checkbox"
              checked={needsReview}
              onChange={(e) => setNeedsReview(e.target.checked)}
            />
            Needs review
          </label>
          <button
            type="submit"
            className="rounded-xl border border-mist bg-foam px-4 py-2.5 text-sm font-medium text-ink"
          >
            Apply
          </button>
        </form>

        {error && <p className="mt-4 text-sm text-coral">{error}</p>}
        {status && <p className="mt-4 text-sm text-sea">{status}</p>}

        <div className="mt-5">
          {loading ? (
            <p className="text-sm text-ink-soft">Loading your vocabulary...</p>
          ) : filteredCount === 0 ? (
            <div className="rounded-2xl bg-sand px-5 py-10 text-center">
              <BookMarked className="mx-auto h-8 w-8 text-sea" />
              <p className="mt-3 font-display text-xl text-ink">No saved words yet</p>
              <p className="mt-1 text-sm text-ink-soft">
                Start chatting and ask Polly “what does that mean?” — words save automatically.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {entries.map((entry) => (
                <article
                  key={entry._id}
                  className="rounded-2xl border border-mist bg-foam/70 p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-xl text-ink">{entry.word}</h3>
                      <p className="text-sm text-ink-soft">{entry.language}</p>
                      {entry.pronunciation ? (
                        <p className="mt-0.5 text-sm text-ink-soft">
                          {entry.pronunciation}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      title="Toggle favorite"
                      onClick={() =>
                        void updateDictionaryWord(entry._id, {
                          favorite: !entry.favorite,
                        }).then(load)
                      }
                      className={`rounded-full p-2 ${
                        entry.favorite ? "text-coral" : "text-ink-soft"
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${entry.favorite ? "fill-current" : ""}`} />
                    </button>
                  </div>

                  <p className="mt-3 text-sm text-ink">{entry.meaning}</p>
                  {entry.exampleSentence && (
                    <p className="mt-2 text-xs italic text-ink-soft">
                      “{entry.exampleSentence}”
                    </p>
                  )}

                  <div className="mt-4">
                    <div className="mb-1 flex justify-between text-xs text-ink-soft">
                      <span>Mastery</span>
                      <span>{entry.masteryScore}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-mist">
                      <div
                        className="h-full rounded-full bg-sea"
                        style={{ width: `${entry.masteryScore}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void reviewDictionaryWord(entry._id, true).then(load)}
                      className="rounded-full bg-sea px-3 py-1.5 text-xs font-medium text-white"
                    >
                      I remembered
                    </button>
                    <button
                      type="button"
                      onClick={() => void reviewDictionaryWord(entry._id, false).then(load)}
                      className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-ink"
                    >
                      Needs practice
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDictionaryWord(entry._id).then(load)}
                      className="ml-auto rounded-full p-1.5 text-ink-soft hover:text-coral"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
