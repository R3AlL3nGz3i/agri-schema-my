import { useMemo, useState } from "react";
import {
  ArrowLeft, Award, BadgeCheck, Bell, BookOpen, Camera, CheckCircle2, ChevronRight,
  CircleHelp, Clock, Coins, Flag, Image as ImageIcon, Leaf, MapPin, MessageCircle,
  Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, ThumbsDown,
  ThumbsUp, UserRound, Users, X,
} from "lucide-react";
import AppLayout from "../components/AppLayout";
import { useApp } from "../context/AppContext";
import {
  COMMUNITY_CROPS, COMMUNITY_TOPICS, createCommunityId, getCreditProgress,
  loadCommunityState, matchesCommunitySearch, relativeCommunityTime, saveCommunityState,
} from "../services/communityStore";

const TABS = [
  { id: "for-you", label: "For You" },
  { id: "needs-help", label: "Needs Help" },
  { id: "solved", label: "Solved" },
  { id: "following", label: "Following" },
];

const EMPTY_FORM = {
  title: "",
  crop: "",
  topic: "Disease",
  location: "",
  body: "",
  duration: "",
  attempted: "",
  photoName: "",
  photoConsent: false,
};

const normaliseEmail = (value) => value?.trim().toLowerCase() || "";

export default function Community() {
  const { user, isAdmin } = useApp();
  const [community, setCommunity] = useState(() => loadCommunityState(user));
  const [view, setView] = useState("home");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);
  const [activeTab, setActiveTab] = useState("for-you");
  const [cropFilter, setCropFilter] = useState("All crops");
  const [topicFilter, setTopicFilter] = useState("All topics");
  const [sort, setSort] = useState("helpful");
  const [showFilters, setShowFilters] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [answer, setAnswer] = useState("");
  const [notice, setNotice] = useState("");

  const commit = (update) => {
    setCommunity((current) => {
      const next = typeof update === "function" ? update(current) : update;
      saveCommunityState(user, next);
      return next;
    });
  };

  const selectedQuestion = community.questions.find((question) => question.id === selectedId);
  const creditProgress = getCreditProgress(community.credits);

  const filteredQuestions = useMemo(() => {
    const results = community.questions.filter((question) => {
      if (searched && !matchesCommunitySearch(question, query)) return false;
      if (cropFilter !== "All crops" && question.crop !== cropFilter) return false;
      if (topicFilter !== "All topics" && question.topic !== topicFilter) return false;
      if (activeTab === "needs-help" && question.status === "solved") return false;
      if (activeTab === "solved" && question.status !== "solved") return false;
      if (activeTab === "following" && !community.follows.includes(question.id)) return false;
      return true;
    });

    return results.sort((left, right) => {
      if (sort === "newest") return new Date(right.createdAt) - new Date(left.createdAt);
      if (sort === "discussed") return right.answers.length - left.answers.length;
      if (left.status !== right.status) return left.status === "solved" ? -1 : 1;
      return right.helpfulCount - left.helpfulCount;
    });
  }, [activeTab, community.follows, community.questions, cropFilter, query, searched, sort, topicFilter]);

  const similarQuestions = useMemo(() => {
    if (!form.title.trim()) return [];
    return community.questions.filter((question) => matchesCommunitySearch(question, form.title)).slice(0, 3);
  }, [community.questions, form.title]);

  const flash = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };

  const openQuestion = (questionId) => {
    setSelectedId(questionId);
    setView("question");
    setAnswer("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const startQuestion = (title = query) => {
    setForm({ ...EMPTY_FORM, title: title.trim() });
    setFormError("");
    setView("ask");
  };

  const clearSearch = () => {
    setQuery("");
    setSearched(false);
  };

  const toggleFollow = (questionId) => {
    commit((current) => ({
      ...current,
      follows: current.follows.includes(questionId)
        ? current.follows.filter((id) => id !== questionId)
        : [...current.follows, questionId],
    }));
  };

  const toggleMeToo = (questionId) => {
    commit((current) => {
      const active = current.meToo.includes(questionId);
      return {
        ...current,
        meToo: active ? current.meToo.filter((id) => id !== questionId) : [...current.meToo, questionId],
        questions: current.questions.map((question) => question.id === questionId
          ? { ...question, meTooCount: Math.max(0, question.meTooCount + (active ? -1 : 1)) }
          : question),
      };
    });
  };

  const vote = (questionId, answerId = null, direction = "up") => {
    const key = answerId ? `answer:${answerId}` : `question:${questionId}`;
    const question = community.questions.find((item) => item.id === questionId);
    const target = answerId ? question?.answers.find((item) => item.id === answerId) : question;
    if (normaliseEmail(target?.authorEmail) === normaliseEmail(user?.email)) {
      flash("You cannot vote on your own contribution.");
      return;
    }

    commit((current) => {
      const previous = current.votes[key] || null;
      const nextVote = previous === direction ? null : direction;
      const helpfulDelta = (previous === "up" ? -1 : 0) + (nextVote === "up" ? 1 : 0);
      const questions = current.questions.map((item) => {
        if (item.id !== questionId) return item;
        if (!answerId) return { ...item, helpfulCount: Math.max(0, item.helpfulCount + helpfulDelta) };
        return {
          ...item,
          answers: item.answers.map((itemAnswer) => itemAnswer.id === answerId
            ? { ...itemAnswer, helpfulCount: Math.max(0, itemAnswer.helpfulCount + helpfulDelta) }
            : itemAnswer),
        };
      });
      return { ...current, questions, votes: { ...current.votes, [key]: nextVote } };
    });
  };

  const submitQuestion = (event) => {
    event.preventDefault();
    if (!form.title.trim() || !form.crop || !form.body.trim()) {
      setFormError("Add a short title, choose the crop status, and describe what you observed.");
      return;
    }
    if (form.photoName && !form.photoConsent) {
      setFormError("Confirm photo-sharing consent before publishing the attached photo.");
      return;
    }

    const question = {
      id: createCommunityId("question"),
      title: form.title.trim(),
      crop: form.crop,
      topic: form.topic,
      location: form.location.trim() || "Location not shared",
      body: form.body.trim(),
      symptoms: [form.duration.trim(), form.attempted.trim()].filter(Boolean).join(" · ") || "Additional observations not recorded",
      author: user?.name || "Community member",
      authorEmail: user?.email || "",
      authorLevel: creditProgress.name,
      createdAt: new Date().toISOString(),
      status: "open",
      helpfulCount: 0,
      meTooCount: 0,
      photoCount: form.photoName ? 1 : 0,
      photoName: form.photoName,
      acceptedAnswerId: null,
      answers: [],
    };
    commit((current) => ({ ...current, questions: [question, ...current.questions], follows: [...current.follows, question.id] }));
    setSelectedId(question.id);
    setView("question");
    setForm(EMPTY_FORM);
    flash("Your question is now visible to the Community.");
  };

  const submitAnswer = (event) => {
    event.preventDefault();
    if (!answer.trim() || !selectedQuestion) return;
    const newAnswer = {
      id: createCommunityId("answer"),
      author: user?.name || "Community member",
      authorEmail: user?.email || "",
      authorRole: creditProgress.name,
      body: answer.trim(),
      helpfulCount: 0,
      createdAt: new Date().toISOString(),
      accepted: false,
      researcherReviewed: false,
    };
    commit((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === selectedQuestion.id
        ? { ...question, answers: [...question.answers, newAnswer] }
        : question),
      follows: current.follows.includes(selectedQuestion.id) ? current.follows : [...current.follows, selectedQuestion.id],
    }));
    setAnswer("");
    flash("Answer posted. You will be notified about replies.");
  };

  const acceptAnswer = (answerId) => {
    if (!selectedQuestion) return;
    const canAccept = isAdmin || normaliseEmail(selectedQuestion.authorEmail) === normaliseEmail(user?.email);
    if (!canAccept) {
      flash("Only the question author or an admin can accept a solution.");
      return;
    }
    const selectedAnswer = selectedQuestion.answers.find((item) => item.id === answerId);
    if (normaliseEmail(selectedAnswer?.authorEmail) === normaliseEmail(user?.email)) {
      flash("You cannot accept your own answer.");
      return;
    }
    commit((current) => ({
      ...current,
      questions: current.questions.map((question) => question.id === selectedQuestion.id
        ? {
          ...question,
          status: "solved",
          acceptedAnswerId: answerId,
          answers: question.answers.map((item) => ({ ...item, accepted: item.id === answerId })),
        }
        : question),
    }));
    flash("Solution accepted. The answerer receives 15 Agri Points.");
  };

  return (
    <AppLayout title="Community">
      <div className="min-h-full bg-[var(--surface)]">
        {notice && (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-xl bg-[var(--ink)] px-4 py-3 text-sm text-white shadow-[var(--shadow-lg)]" role="status">
            {notice}
          </div>
        )}
        {view === "home" && (
          <CommunityHome
            community={community}
            creditProgress={creditProgress}
            query={query}
            setQuery={setQuery}
            searched={searched}
            setSearched={setSearched}
            onClearSearch={clearSearch}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            cropFilter={cropFilter}
            setCropFilter={setCropFilter}
            topicFilter={topicFilter}
            setTopicFilter={setTopicFilter}
            sort={sort}
            setSort={setSort}
            showFilters={showFilters}
            setShowFilters={setShowFilters}
            questions={filteredQuestions}
            onOpen={openQuestion}
            onStartQuestion={startQuestion}
            onFollow={toggleFollow}
            onMeToo={toggleMeToo}
            onVote={vote}
          />
        )}
        {view === "ask" && (
          <AskQuestion
            form={form}
            setForm={setForm}
            error={formError}
            similarQuestions={similarQuestions}
            onSubmit={submitQuestion}
            onBack={() => setView("home")}
            onOpen={openQuestion}
          />
        )}
        {view === "question" && selectedQuestion && (
          <QuestionDetail
            question={selectedQuestion}
            votes={community.votes}
            followed={community.follows.includes(selectedQuestion.id)}
            meToo={community.meToo.includes(selectedQuestion.id)}
            answer={answer}
            setAnswer={setAnswer}
            currentUser={user}
            isAdmin={isAdmin}
            onBack={() => setView("home")}
            onVote={vote}
            onFollow={toggleFollow}
            onMeToo={toggleMeToo}
            onAnswer={submitAnswer}
            onAccept={acceptAnswer}
            onReport={() => flash("Report received for moderator review.")}
          />
        )}
      </div>
    </AppLayout>
  );
}

function CommunityHome({
  community, creditProgress, query, setQuery, searched, setSearched, onClearSearch,
  activeTab, setActiveTab, cropFilter, setCropFilter, topicFilter, setTopicFilter,
  sort, setSort, showFilters, setShowFilters, questions, onOpen, onStartQuestion,
  onFollow, onMeToo, onVote,
}) {
  const quickMatches = searched
    ? community.questions.filter((question) => matchesCommunitySearch(question, query)).slice(0, 4)
    : [];

  return (
    <>
      <section className="border-b border-[var(--brand-dark)]/10 bg-gradient-to-br from-[var(--brand-deep)] via-[var(--brand-dark)] to-[var(--brand)] px-4 py-9 text-white sm:py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-light)]">
            <Users size={15} /> AgriScheme Community
          </div>
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Find an answer before starting a new question.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-white/80 sm:text-base">
                Search solved crop cases, compare field observations, and ask growers or researchers when you still need help.
              </p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-sm lg:min-w-64">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-[var(--brand-deep)]"><Coins size={20} /></div>
              <div>
                <p className="text-xs text-white/70">Your Agri Points</p>
                <p className="text-xl font-bold">{community.credits} <span className="text-xs font-medium text-white/70">· {creditProgress.name}</span></p>
              </div>
            </div>
          </div>

          <div className="mt-7 max-w-4xl">
            <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/20 bg-white px-4 shadow-[var(--shadow-lg)] focus-within:ring-4 focus-within:ring-white/20">
              <Search size={20} className="shrink-0 text-[var(--ink-soft)]" />
              <input
                value={query}
                onChange={(event) => {
                  const value = event.target.value;
                  setQuery(value);
                  setSearched(Boolean(value.trim()));
                  if (value.trim()) setActiveTab("for-you");
                }}
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--ink)] outline-none sm:text-base"
                placeholder="Search or ask a question"
                aria-label="Search or ask a Community question"
              />
              {query && <button type="button" onClick={onClearSearch} className="rounded-lg p-2 hover:bg-[var(--surface-sunk)]" aria-label="Clear search"><X size={16} /></button>}
            </div>

            {searched && (
              <div className="mt-2 overflow-hidden rounded-2xl border border-[var(--line)] bg-white text-[var(--ink-soft)] shadow-[var(--shadow-lg)]">
                <div className="border-b border-[var(--line)] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">
                  Suggested Community discussions
                </div>
                {quickMatches.length > 0 ? (
                  <div className="divide-y divide-[var(--line)]">
                    {quickMatches.map((question) => (
                      <button key={question.id} onClick={() => onOpen(question.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[var(--surface)]">
                        <Search size={15} className="shrink-0 text-[var(--ink-faint)]" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--ink-soft)]">{question.title}</p>
                          <p className="mt-0.5 text-[11px] text-[var(--ink-faint)]">{question.crop} · {question.topic} · {question.answers.length} answers</p>
                        </div>
                        <StatusBadge solved={question.status === "solved"} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="px-4 py-4 text-sm text-[var(--ink-soft)]">No similar discussion found.</div>
                )}
                <button onClick={() => onStartQuestion(query)} className="flex w-full items-center gap-3 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm font-semibold text-[var(--brand)] hover:bg-[#f3f8f4]">
                  <MessageCircle size={16} /> Ask the Community: “{query.trim()}”
                  <ChevronRight size={15} className="ml-auto" />
                </button>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {COMMUNITY_CROPS.slice(1).map((crop) => (
              <button key={crop} onClick={() => setCropFilter(cropFilter === crop ? "All crops" : crop)}
                aria-pressed={cropFilter === crop}
                title={cropFilter === crop ? `Clear ${crop} filter` : `Filter by ${crop}`}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${cropFilter === crop ? "border-accent bg-accent text-[var(--brand-deep)]" : "border-white/20 bg-white/10 text-white/90 hover:bg-white/20"}`}>
                {crop}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_290px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-[var(--surface-sunk)] p-1">
              {TABS.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${activeTab === tab.id ? "bg-white text-[var(--brand-dark)] shadow-[var(--shadow-sm)]" : "text-[var(--ink-soft)] hover:text-[var(--ink)]"}`}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowFilters(!showFilters)} className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink-soft)] hover:border-[var(--brand-light)]">
                <SlidersHorizontal size={14} /> Filters
              </button>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 grid gap-3 rounded-xl border border-[var(--line)] bg-white p-3 sm:grid-cols-3">
              <FilterSelect label="Crop" value={cropFilter} onChange={setCropFilter} options={COMMUNITY_CROPS} />
              <FilterSelect label="Topic" value={topicFilter} onChange={setTopicFilter} options={COMMUNITY_TOPICS} />
              <FilterSelect label="Sort" value={sort} onChange={setSort} options={["helpful", "newest", "discussed"]} display={(value) => ({ helpful: "Most helpful", newest: "Newest", discussed: "Most discussed" }[value])} />
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-[var(--ink)]">
                {searched ? `Search results for “${query}”` : TABS.find((tab) => tab.id === activeTab)?.label}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{questions.length} discussion{questions.length === 1 ? "" : "s"}</p>
            </div>
            {(cropFilter !== "All crops" || topicFilter !== "All topics") && (
              <button onClick={() => { setCropFilter("All crops"); setTopicFilter("All topics"); }} className="text-xs font-medium text-[var(--brand)] hover:underline">Clear filters</button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {questions.map((question) => (
              <QuestionCard
                key={question.id}
                question={question}
                followed={community.follows.includes(question.id)}
                meToo={community.meToo.includes(question.id)}
                vote={community.votes[`question:${question.id}`]}
                onOpen={() => onOpen(question.id)}
                onFollow={() => onFollow(question.id)}
                onMeToo={() => onMeToo(question.id)}
                onVote={(direction) => onVote(question.id, null, direction)}
              />
            ))}
          </div>

          {questions.length === 0 && (
            <div className="mt-4 rounded-2xl border border-dashed border-[var(--brand-light)] bg-[#f3f8f4] p-8 text-center">
              <CircleHelp className="mx-auto text-[var(--brand)]" size={28} />
              <h3 className="mt-3 font-semibold text-[var(--ink)]">No matching Community solution found</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-[var(--ink-soft)]">We searched crop cases, observations, and existing answers. You can change the search or ask members for help.</p>
              <button onClick={() => onStartQuestion(query)} className="btn-primary mt-4 inline-flex items-center gap-2 px-4 py-2.5 text-sm">
                <MessageCircle size={15} /> Ask this question
              </button>
            </div>
          )}

          {searched && questions.length > 0 && (
            <div className="mt-4 flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center">
              <div><p className="text-sm font-semibold text-amber-900">None of these solve your concern?</p><p className="text-xs text-amber-700">Carry your search into a new Community question.</p></div>
              <button onClick={() => onStartQuestion(query)} className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-300">Ask the Community</button>
            </div>
          )}
        </div>

        <CommunitySidebar community={community} creditProgress={creditProgress} onOpen={onOpen} />
      </div>
    </>
  );
}

function CommunitySidebar({ community, creditProgress, onOpen }) {
  const unanswered = community.questions.filter((question) => question.status === "open").slice(0, 3);
  return (
    <aside className="space-y-4">
      <section className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Coins size={18} className="text-accent" /><h3 className="font-semibold text-[var(--ink)]">Agri Points</h3></div>
          <span className="text-xl font-bold text-[var(--brand-dark)]">{community.credits}</span>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs"><span className="font-semibold text-[var(--ink-soft)]">{creditProgress.name}</span><span className="text-[var(--ink-faint)]">{creditProgress.remaining} to next level</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-sunk)]"><div className="h-full rounded-full bg-[var(--brand)]" style={{ width: `${creditProgress.percent}%` }} /></div>
        <p className="mt-3 text-xs leading-5 text-[var(--ink-soft)]">Agri Points recognise helpful answers and accepted solutions. Posting alone does not earn points.</p>
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Recent activity</p>
          {community.creditLedger.slice(0, 3).map((entry) => (
            <div key={entry.id} className="flex items-center justify-between py-1.5 text-xs"><span className="text-[var(--ink-soft)]">{entry.label}</span><span className="font-bold text-[var(--brand)]">+{entry.amount}</span></div>
          ))}
        </div>
        <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800"><Award size={14} className="mb-1" />Earn Agri Points by sharing useful, trusted farming knowledge.</div>
      </section>

      <section className="card">
        <div className="flex items-center gap-2"><ShieldCheck size={17} className="text-[var(--brand)]" /><h3 className="font-semibold text-[var(--ink)]">Community rules</h3></div>
        <ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-soft)]">
          <li>Share observations, not unsupported certainty.</li>
          <li>Do not recommend chemicals for an unknown crop.</li>
          <li>Protect exact locations and personal information.</li>
          <li>Report unsafe or misleading advice.</li>
        </ul>
      </section>

      <section className="card">
        <div className="flex items-center justify-between"><h3 className="font-semibold text-[var(--ink)]">Needs a response</h3><Sparkles size={16} className="text-accent" /></div>
        <div className="mt-3 space-y-3">
          {unanswered.map((question) => (
            <button key={question.id} onClick={() => onOpen(question.id)} className="block w-full text-left group">
              <p className="text-[11px] font-semibold text-[var(--brand)]">{question.crop} · {question.answers.length} answers</p>
              <p className="mt-0.5 text-xs leading-5 text-[var(--ink-soft)] group-hover:text-[var(--brand-dark)]">{question.title}</p>
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}

function QuestionCard({ question, followed, meToo, vote, onOpen, onFollow, onMeToo, onVote }) {
  const accepted = question.answers.find((answer) => answer.accepted);
  return (
    <article className="card card-hover p-4 transition hover:border-[var(--brand-light)] sm:p-5">
      <div className="flex gap-3">
        <div className="hidden w-12 shrink-0 flex-col items-center gap-1 sm:flex">
          <button onClick={() => onVote("up")} className={`rounded-lg p-1.5 ${vote === "up" ? "bg-[#e7f3ea] text-[var(--brand)]" : "text-[var(--ink-faint)] hover:bg-[var(--surface-sunk)]"}`} aria-label="Mark question helpful"><ThumbsUp size={15} /></button>
          <span className="text-xs font-bold text-[var(--ink-soft)]">{question.helpfulCount}</span>
          <button onClick={() => onVote("down")} className={`rounded-lg p-1.5 ${vote === "down" ? "bg-[var(--surface-sunk)] text-[var(--ink-soft)]" : "text-[var(--ink-faint)] hover:bg-[var(--surface-sunk)]"}`} aria-label="Mark question not helpful"><ThumbsDown size={15} /></button>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge solved={question.status === "solved"} />
            <span className="rounded-full bg-[#e7f3ea] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand)]">{question.crop}</span>
            <span className="rounded-full bg-[var(--surface-sunk)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]">{question.topic}</span>
            {question.photoCount > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]"><ImageIcon size={12} /> {question.photoCount}</span>}
          </div>
          <button onClick={onOpen} className="mt-3 block text-left text-base font-semibold leading-6 text-[var(--ink)] hover:text-[var(--brand-dark)] sm:text-lg">{question.title}</button>
          <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-[var(--ink-soft)]">{accepted ? accepted.body : question.body}</p>
          {accepted && <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)]"><CheckCircle2 size={13} /> Accepted solution by {accepted.author}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-[var(--ink-faint)]">
            <span className="inline-flex items-center gap-1"><UserRound size={12} /> {question.author}</span>
            <span className="inline-flex items-center gap-1"><MapPin size={12} /> {question.location}</span>
            <span className="inline-flex items-center gap-1"><MessageCircle size={12} /> {question.answers.length} answers</span>
            <span className="inline-flex items-center gap-1"><Clock size={12} /> {relativeCommunityTime(question.createdAt)}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3">
            <button onClick={onMeToo} className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${meToo ? "bg-amber-100 text-amber-800" : "bg-[var(--surface-sunk)] text-[var(--ink-soft)] hover:bg-amber-50"}`}>I have this too · {question.meTooCount}</button>
            <button onClick={onFollow} className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${followed ? "bg-[#e7f3ea] text-[var(--brand)]" : "bg-[var(--surface-sunk)] text-[var(--ink-soft)] hover:bg-[#f3f8f4]"}`}><Bell size={12} /> {followed ? "Following" : "Follow"}</button>
            <button onClick={onOpen} className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline">Open discussion <ChevronRight size={13} /></button>
          </div>
        </div>
      </div>
    </article>
  );
}

function AskQuestion({ form, setForm, error, similarQuestions, onSubmit, onBack, onOpen }) {
  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  return (
    <div className="mx-auto max-w-6xl px-4 py-7">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--brand)]"><ArrowLeft size={16} /> Back to Community</button>
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={onSubmit} className="card p-5 sm:p-7">
          <div className="flex items-start gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e7f3ea] text-[var(--brand)]"><MessageCircle size={19} /></div><div><h1 className="text-2xl font-bold text-[var(--ink)]">Ask the Community</h1><p className="mt-1 text-sm text-[var(--ink-soft)]">Share what you observed. Members can help you inspect the issue, but Community replies are not automatically verified.</p></div></div>
          {error && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          <div className="mt-6 space-y-5">
            <Field label="Short question" hint="Start with one clear sentence.">
              <input value={form.title} onChange={(event) => update("title", event.target.value)} maxLength={140} placeholder="e.g. Brown spots appeared on paddy leaves after rain" className="field-input" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Crop">
                <select value={form.crop} onChange={(event) => update("crop", event.target.value)} className="field-input">
                  <option value="">Select crop status</option>
                  {COMMUNITY_CROPS.slice(1).map((crop) => <option key={crop}>{crop}</option>)}
                </select>
              </Field>
              <Field label="Topic">
                <select value={form.topic} onChange={(event) => update("topic", event.target.value)} className="field-input">
                  {COMMUNITY_TOPICS.slice(1).map((topic) => <option key={topic}>{topic}</option>)}
                </select>
              </Field>
            </div>
            {form.crop === "Unknown crop" && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800"><CircleHelp size={15} className="mb-1" />Describe the plant's leaves, stem, flowers, fruit, size, and where it grows. The Community can help identify it, but the crop remains unconfirmed until you verify it.</div>}
            <Field label="What did you observe?" hint="Include symptoms, affected plant parts, and whether the issue is spreading.">
              <textarea value={form.body} onChange={(event) => update("body", event.target.value)} rows={6} placeholder="Describe what changed and what the plant looks like now…" className="field-input resize-y py-3" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="When did it start?" hint="Optional"><input value={form.duration} onChange={(event) => update("duration", event.target.value)} placeholder="e.g. Five days ago" className="field-input" /></Field>
              <Field label="General location" hint="State only; do not share an exact address"><input value={form.location} onChange={(event) => update("location", event.target.value)} placeholder="e.g. Kedah" className="field-input" /></Field>
            </div>
            <Field label="What have you tried?" hint="Optional"><textarea value={form.attempted} onChange={(event) => update("attempted", event.target.value)} rows={3} placeholder="Inspection or action already attempted…" className="field-input resize-y py-3" /></Field>
            <Field label="Photo" hint="Prototype stores the file name only; production will use protected object storage.">
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--surface-sunk)] px-4 py-5 text-sm text-[var(--ink-soft)] hover:border-[var(--brand-light)] hover:bg-[#f3f8f4]">
                <Camera size={18} /> {form.photoName || "Choose a crop photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={(event) => update("photoName", event.target.files?.[0]?.name || "")} />
              </label>
              {form.photoName && <label className="mt-3 flex items-start gap-2 text-xs leading-5 text-[var(--ink-soft)]"><input type="checkbox" checked={form.photoConsent} onChange={(event) => update("photoConsent", event.target.checked)} className="mt-1 accent-[var(--brand)]" />I consent to sharing this photo with signed-in Community members. I have removed personal or exact-location information.</label>}
            </Field>
          </div>
          <div className="mt-7 flex flex-col-reverse gap-2 border-t border-[var(--line)] pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onBack} className="btn-outline px-4 py-2.5 text-sm">Cancel</button>
            <button type="submit" className="btn-primary inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"><Send size={15} /> Publish question</button>
          </div>
        </form>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[var(--line)] bg-[#f3f8f4] p-5"><div className="flex items-center gap-2 text-[var(--brand-dark)]"><Search size={17} /><h2 className="font-semibold">Similar solved questions</h2></div><p className="mt-1 text-xs leading-5 text-[var(--brand)]">Review these before publishing to avoid a duplicate discussion.</p>
            <div className="mt-4 space-y-3">
              {similarQuestions.length > 0 ? similarQuestions.map((question) => (
                <button key={question.id} onClick={() => onOpen(question.id)} className="block w-full rounded-xl bg-white p-3 text-left shadow-[var(--shadow-sm)] hover:ring-1 hover:ring-[var(--brand-light)]"><StatusBadge solved={question.status === "solved"} /><p className="mt-2 text-xs font-semibold leading-5 text-[var(--ink-soft)]">{question.title}</p><p className="mt-1 text-[11px] text-[var(--ink-faint)]">{question.answers.length} answers · {question.helpfulCount} helpful</p></button>
              )) : <p className="rounded-xl border border-dashed border-[var(--brand-light)] p-4 text-xs leading-5 text-[var(--brand)]">Start typing your question to check for similar discussions.</p>}
            </div>
          </div>
          <div className="card"><div className="flex items-center gap-2"><BookOpen size={17} className="text-[var(--brand)]" /><h2 className="font-semibold text-[var(--ink)]">A useful question includes</h2></div><ul className="mt-3 space-y-2 text-xs leading-5 text-[var(--ink-soft)]"><li>• What changed and when</li><li>• Which plant parts are affected</li><li>• Weather or field conditions</li><li>• Clear photos from several angles</li><li>• What you have already tried</li></ul></div>
        </aside>
      </div>
    </div>
  );
}

function QuestionDetail({ question, votes, followed, meToo, answer, setAnswer, currentUser, isAdmin, onBack, onVote, onFollow, onMeToo, onAnswer, onAccept, onReport }) {
  const answers = [...question.answers].sort((left, right) => Number(right.accepted) - Number(left.accepted) || right.helpfulCount - left.helpfulCount);
  const canAccept = isAdmin || normaliseEmail(question.authorEmail) === normaliseEmail(currentUser?.email);
  return (
    <div className="mx-auto max-w-5xl px-4 py-7">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ink-soft)] hover:text-[var(--brand)]"><ArrowLeft size={16} /> Back to Community</button>
      <article className="card mt-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge solved={question.status === "solved"} /><span className="rounded-full bg-[#e7f3ea] px-2.5 py-1 text-[11px] font-semibold text-[var(--brand)]">{question.crop}</span><span className="rounded-full bg-[var(--surface-sunk)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-soft)]">{question.topic}</span>{question.photoCount > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-[var(--ink-faint)]"><ImageIcon size={12} /> {question.photoCount} photo{question.photoCount === 1 ? "" : "s"}</span>}</div>
        <h1 className="mt-4 text-2xl font-bold leading-tight text-[var(--ink)] sm:text-3xl">{question.title}</h1>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--ink-faint)]"><span className="inline-flex items-center gap-1"><UserRound size={13} /> {question.author} · {question.authorLevel}</span><span className="inline-flex items-center gap-1"><MapPin size={13} /> {question.location}</span><span className="inline-flex items-center gap-1"><Clock size={13} /> {relativeCommunityTime(question.createdAt)}</span></div>
        <p className="mt-6 whitespace-pre-line text-sm leading-7 text-[var(--ink-soft)]">{question.body}</p>
        <div className="mt-4 rounded-xl bg-[var(--surface-sunk)] p-4"><p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">Case notes</p><p className="mt-1 text-sm text-[var(--ink-soft)]">{question.symptoms}</p></div>
        {question.photoCount > 0 && <div className="mt-4 flex h-40 items-center justify-center rounded-xl border border-dashed border-[var(--brand-light)] bg-[#f3f8f4] text-[var(--brand)]"><div className="text-center"><Leaf size={25} className="mx-auto" /><p className="mt-2 text-xs font-medium">Crop photo shared with Community</p>{question.photoName && <p className="mt-1 text-[11px] text-[var(--brand-light)]">{question.photoName}</p>}</div></div>}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4">
          <VoteButtons count={question.helpfulCount} value={votes[`question:${question.id}`]} onVote={(direction) => onVote(question.id, null, direction)} />
          <button onClick={() => onMeToo(question.id)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${meToo ? "bg-amber-100 text-amber-800" : "bg-[var(--surface-sunk)] text-[var(--ink-soft)] hover:bg-amber-50"}`}>I have this problem too · {question.meTooCount}</button>
          <button onClick={() => onFollow(question.id)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold ${followed ? "bg-[#e7f3ea] text-[var(--brand)]" : "bg-[var(--surface-sunk)] text-[var(--ink-soft)] hover:bg-[#f3f8f4]"}`}><Bell size={13} /> {followed ? "Following" : "Follow"}</button>
          <button onClick={onReport} className="ml-auto inline-flex items-center gap-1.5 px-2 py-2 text-xs text-[var(--ink-faint)] hover:text-red-600"><Flag size={13} /> Report</button>
        </div>
      </article>

      <div className="mt-6 flex items-center justify-between"><div><h2 className="text-lg font-bold text-[var(--ink)]">{answers.length} Community answer{answers.length === 1 ? "" : "s"}</h2><p className="text-xs text-[var(--ink-faint)]">Accepted means it helped the author; it is not automatic scientific verification.</p></div></div>
      <div className="mt-4 space-y-4">
        {answers.map((item) => (
          <article key={item.id} className={`rounded-2xl border bg-white p-5 shadow-[var(--shadow-sm)] sm:p-6 ${item.accepted ? "border-[var(--brand-light)] ring-2 ring-[#d7ecdd]" : "border-[var(--line)]"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f3ea] text-[var(--brand)]"><UserRound size={16} /></div><div><p className="text-sm font-semibold text-[var(--ink)]">{item.author}</p><div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-faint)]"><span>{item.authorRole}</span>{item.researcherReviewed && <span className="inline-flex items-center gap-1 font-semibold text-blue-700"><BadgeCheck size={12} /> Researcher reviewed</span>}</div></div></div>
              {item.accepted && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e7f3ea] px-3 py-1.5 text-xs font-bold text-[var(--brand)]"><CheckCircle2 size={14} /> Accepted solution</span>}
            </div>
            <p className="mt-5 whitespace-pre-line text-sm leading-7 text-[var(--ink-soft)]">{item.body}</p>
            {item.researcherReviewed && <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800"><ShieldCheck size={14} className="mb-1" />Reviewed by an approved researcher. Continue to follow local agricultural guidance and product labels.</div>}
            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--line)] pt-4">
              <VoteButtons count={item.helpfulCount} value={votes[`answer:${item.id}`]} onVote={(direction) => onVote(question.id, item.id, direction)} compact />
              <span className="text-[11px] text-[var(--ink-faint)]">{relativeCommunityTime(item.createdAt)}</span>
              {canAccept && !item.accepted && <button onClick={() => onAccept(item.id)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-[var(--brand-light)] px-3 py-2 text-xs font-semibold text-[var(--brand)] hover:bg-[#f3f8f4]"><CheckCircle2 size={13} /> Accept as solution</button>}
              <button onClick={onReport} className={`${canAccept && !item.accepted ? "" : "ml-auto"} text-[var(--ink-faint)] hover:text-red-500`} aria-label="Report answer"><Flag size={13} /></button>
            </div>
          </article>
        ))}
        {answers.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-white p-7 text-center"><MessageCircle className="mx-auto text-[var(--ink-faint)]" /><p className="mt-2 text-sm font-medium text-[var(--ink-soft)]">No answers yet</p><p className="text-xs text-[var(--ink-faint)]">Share a careful observation to help this member.</p></div>}
      </div>

      <form onSubmit={onAnswer} className="card mt-6 p-5 sm:p-6">
        <div className="flex items-center gap-2"><MessageCircle size={18} className="text-[var(--brand)]" /><h2 className="font-semibold text-[var(--ink)]">Write an answer</h2></div>
        <p className="mt-1 text-xs leading-5 text-[var(--ink-soft)]">Explain what to inspect and when to escalate. Avoid unsupported diagnosis or chemical advice.</p>
        <textarea value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder="Share an observation, safe inspection step, or useful source…" className="field-input mt-4 resize-y py-3" />
        <div className="mt-3 flex justify-end"><button disabled={!answer.trim()} className="btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-40"><Send size={14} /> Post answer</button></div>
      </form>
    </div>
  );
}

function VoteButtons({ count, value, onVote, compact = false }) {
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-[var(--line)] bg-white">
      <button onClick={() => onVote("up")} type="button" className={`p-2 ${value === "up" ? "bg-[#e7f3ea] text-[var(--brand)]" : "text-[var(--ink-faint)] hover:bg-[var(--surface)]"}`} aria-label="Helpful"><ThumbsUp size={compact ? 13 : 14} /></button>
      <span className="min-w-8 text-center text-xs font-bold text-[var(--ink-soft)]">{count}</span>
      <button onClick={() => onVote("down")} type="button" className={`p-2 ${value === "down" ? "bg-[var(--surface-sunk)] text-[var(--ink-soft)]" : "text-[var(--ink-faint)] hover:bg-[var(--surface)]"}`} aria-label="Not helpful"><ThumbsDown size={compact ? 13 : 14} /></button>
    </div>
  );
}

function StatusBadge({ solved }) {
  return solved
    ? <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800"><CheckCircle2 size={12} /> Solved</span>
    : <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700"><CircleHelp size={12} /> Needs help</span>;
}

function FilterSelect({ label, value, onChange, options, display = (item) => item }) {
  return <label><span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-faint)]">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink-soft)] outline-none focus:border-[var(--brand-light)]">{options.map((option) => <option key={option} value={option}>{display(option)}</option>)}</select></label>;
}

function Field({ label, hint, children }) {
  return <label className="block"><span className="text-sm font-semibold text-[var(--ink-soft)]">{label}</span>{hint && <span className="ml-2 text-xs font-normal text-[var(--ink-faint)]">{hint}</span>}<div className="mt-2">{children}</div></label>;
}
