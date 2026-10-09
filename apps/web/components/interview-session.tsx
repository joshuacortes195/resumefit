"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Mic, Square, X } from "lucide-react";
import { answerQuestion } from "@/app/actions/practice";
import { ScoreRing } from "@/components/score-ring";
import { CARD, INPUT, LINK_BUTTON, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/ui/buttons";
import type { InterviewQuestion } from "@/lib/ai/prompts/interview";
import type { PracticeAnswer } from "@/lib/data/practice";

type SessionProps = {
  id: string;
  title: string;
  questions: InterviewQuestion[];
  answers: (PracticeAnswer | null)[];
  // false when the admin has switched voice answers off
  voice: boolean;
};

// friendly names for the kinds of question
const KINDS: Record<InterviewQuestion["type"], string> = { behavioral: "Behavioral", technical: "Role specific", resume: "About your resume" };

// the four parts of a well told story
const STAR = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
] as const;

// the browser's speech to text, which only some browsers have
type Recognition = { continuous: boolean; interimResults: boolean; lang: string; start: () => void; stop: () => void; onresult: ((event: { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
function speechRecognition(): (new () => Recognition) | null {
  const scope = globalThis as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null;
}

// a practice interview: one question at a time, then a summary
export function InterviewSession({ id, title, questions, answers: initial, voice }: SessionProps) {
  const [answers, setAnswers] = useState(initial);
  const firstOpen = initial.findIndex((answer) => !answer);
  const [index, setIndex] = useState(firstOpen === -1 ? questions.length : firstOpen);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [spoken, setSpoken] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [canSpeak, setCanSpeak] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const recognition = useRef<Recognition | null>(null);
  const startedAt = useRef<number | null>(null);

  // voice answers are only offered where the browser can do them
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanSpeak(voice && speechRecognition() !== null);
    return () => recognition.current?.stop();
  }, [voice]);

  // counts the seconds while the microphone is on
  useEffect(() => {
    if (!listening) return;
    const timer = setInterval(() => setSeconds(Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000)), 500);
    return () => clearInterval(timer);
  }, [listening]);

  // starts or stops listening, adding what is heard to the answer box
  function toggleMic() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Speech = speechRecognition();
    if (!Speech) return;
    const session = new Speech();
    session.continuous = true;
    session.interimResults = false;
    session.lang = "en-US";
    session.onresult = (event) => {
      const heard = [...event.results].slice(event.resultIndex).filter((result) => result.isFinal).map((result) => result[0].transcript).join(" ");
      if (heard) setText((current) => `${current} ${heard}`.trim());
    };
    session.onend = () => setListening(false);
    session.onerror = () => {
      setListening(false);
      setError("We could not hear you. Check that the microphone is allowed for this site, or type your answer.");
    };
    recognition.current = session;
    startedAt.current = Date.now() - seconds * 1000;
    setSpoken(true);
    setError(null);
    setListening(true);
    session.start();
  }

  // moves to another question with a clean answer box
  function go(to: number) {
    recognition.current?.stop();
    setIndex(to);
    setText("");
    setSeconds(0);
    setSpoken(false);
    setNote(null);
    setError(null);
  }

  // sends the answer off to be measured and coached
  function submit() {
    recognition.current?.stop();
    setError(null);
    startTransition(async () => {
      const result = await answerQuestion({ sessionId: id, index, text, seconds: spoken ? seconds : null, spoken });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnswers((all) => all.map((answer, position) => (position === index ? result.answer : answer)));
      setNote(result.note);
    });
  }

  const question = questions[index];
  const answer = answers[index] ?? null;
  const done = answers.filter(Boolean).length;
  const scores = answers.flatMap((entry) => (entry?.feedback ? [entry.feedback.score] : []));
  const average = scores.length > 0 ? Math.round(scores.reduce((total, score) => total + score, 0) / scores.length) : null;

  // the summary, once the last question is behind you
  if (!question) {
    const fillers = answers.reduce((total, entry) => total + (entry?.metrics.fillerCount ?? 0), 0);
    const paces = answers.flatMap((entry) => (entry?.metrics.wordsPerMinute ? [entry.metrics.wordsPerMinute] : []));
    return (
      <div className="space-y-6">
        <section className={`${CARD} flex flex-wrap items-center gap-6 p-6`}>
          {average !== null && <ScoreRing score={average} size="lg" label="Average answer score" />}
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">Session summary</h2>
            <p className="mt-1 text-muted">
              You answered {done} of {questions.length} questions for {title}.
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <dt className="text-muted">Filler words</dt>
                <dd className="font-display text-2xl font-semibold tabular-nums">{fillers}</dd>
              </div>
              {paces.length > 0 && (
                <div>
                  <dt className="text-muted">Speaking pace</dt>
                  <dd className="font-display text-2xl font-semibold tabular-nums">{Math.round(paces.reduce((total, pace) => total + pace, 0) / paces.length)} wpm</dd>
                </div>
              )}
            </dl>
            {average === null && done > 0 && <p className="mt-3 text-sm text-muted">Coaching scores need the AI features. Your answers and the measurements above are saved either way.</p>}
          </div>
        </section>

        <ol className="space-y-3">
          {questions.map((entry, position) => (
            <li key={position} className={`${CARD} flex items-center gap-4 p-4`}>
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary">{position + 1}</span>
              <p className="min-w-0 flex-1 text-sm">{entry.question}</p>
              <span className="shrink-0 text-sm tabular-nums text-muted">{answers[position]?.feedback ? `${answers[position]?.feedback?.score}` : answers[position] ? "Answered" : "Skipped"}</span>
              <button type="button" onClick={() => go(position)} className={`shrink-0 text-sm ${LINK_BUTTON}`}>
                {answers[position] ? "Review" : "Answer"}
              </button>
            </li>
          ))}
        </ol>
        <Link href="/interview" className={SECONDARY_BUTTON}>
          Practice for another job
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* where you are in the session */}
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(done / questions.length) * 100}%` }} />
        </div>
        <p className="text-sm text-muted">
          Question {index + 1} of {questions.length}
        </p>
      </div>

      <section className={`${CARD} p-6`}>
        <p className="text-sm text-muted">{KINDS[question.type]}</p>
        <h2 className="mt-1 text-xl font-semibold">{question.question}</h2>

        {answer ? (
          <Feedback answer={answer} note={note} />
        ) : (
          <div className="mt-5 space-y-3">
            <textarea aria-label="Your answer" value={text} onChange={(event) => setText(event.target.value)} rows={8} placeholder="Type your answer, or press the microphone and say it out loud." className={`${INPUT} resize-y p-3 leading-6`} />
            <div className="flex flex-wrap items-center gap-3">
              {canSpeak ? (
                <button type="button" onClick={toggleMic} aria-pressed={listening} className={`${SECONDARY_BUTTON} ${listening ? "border-danger text-danger" : ""}`}>
                  {listening ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
                  {listening ? `Stop, ${seconds}s` : spoken ? "Keep talking" : "Answer out loud"}
                </button>
              ) : (
                <p className="text-xs text-muted">Voice answers need Chrome or Edge. Typing works everywhere.</p>
              )}
              <button type="button" disabled={pending || text.trim() === ""} onClick={submit} className={PRIMARY_BUTTON}>
                {pending ? "Reviewing your answer..." : "Get feedback"}
              </button>
              <p className="text-xs text-muted">Aim for one to two minutes, about 150 to 300 words.</p>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </section>

      {/* back, next and try again */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={index === 0} onClick={() => go(index - 1)} className={SECONDARY_BUTTON}>
          <ChevronLeft className="size-4" aria-hidden />
          Back
        </button>
        {answer && (
          <button
            type="button"
            onClick={() => {
              setAnswers((all) => all.map((entry, position) => (position === index ? null : entry)));
              setText(answer.text);
              setNote(null);
            }}
            className={`text-sm ${LINK_BUTTON}`}
          >
            Try this one again
          </button>
        )}
        <button type="button" onClick={() => go(index + 1)} className={answer ? PRIMARY_BUTTON : SECONDARY_BUTTON}>
          {index === questions.length - 1 ? "Finish" : answer ? "Next question" : "Skip"}
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

// what we measured and what the coach said about one answer
function Feedback({ answer, note }: { answer: PracticeAnswer; note: string | null }) {
  const { metrics, feedback } = answer;
  return (
    <div className="mt-5 animate-rise space-y-5">
      <div className="rounded-lg bg-background p-3 text-sm">
        <p className="font-medium">Your answer</p>
        <p className="mt-1 whitespace-pre-wrap text-muted">{answer.text}</p>
      </div>

      {/* measured right here, no ai involved */}
      <dl className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
        {feedback && (
          <div className="flex items-center gap-3">
            <ScoreRing score={feedback.score} label="Answer score" />
            <dt className="text-muted">Answer score</dt>
          </div>
        )}
        <div>
          <dt className="text-muted">Length</dt>
          <dd className="font-semibold tabular-nums">{metrics.words} words</dd>
        </div>
        {metrics.wordsPerMinute !== null && (
          <div>
            <dt className="text-muted">Pace</dt>
            <dd className="font-semibold tabular-nums">
              {metrics.wordsPerMinute} words a minute
              <span className="font-normal text-muted">{metrics.wordsPerMinute > 170 ? ", a little fast" : metrics.wordsPerMinute < 110 ? ", a little slow" : ", comfortable"}</span>
            </dd>
          </div>
        )}
        <div>
          <dt className="text-muted">Filler words</dt>
          <dd className="font-semibold tabular-nums">
            {metrics.fillerCount}
            {metrics.fillers.length > 0 && <span className="font-normal text-muted"> ({metrics.fillers.map((filler) => `${filler.word} ${filler.count}`).join(", ")})</span>}
          </dd>
        </div>
      </dl>

      {feedback ? (
        <>
          {/* did the answer tell the whole story */}
          <div>
            <p className="text-sm font-semibold">STAR structure</p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {STAR.map(([key, label]) => (
                <li key={key} className="flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-medium">
                  {feedback.star[key] ? <Check className="size-3.5 text-success" aria-hidden /> : <X className="size-3.5 text-danger" aria-hidden />}
                  {label}
                  <span className="sr-only">{feedback.star[key] ? ", covered" : ", missing"}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold">Fit for this job</p>
              <p className="mt-1 text-muted">{feedback.relevance}</p>
            </div>
            <div>
              <p className="font-semibold">Detail and numbers</p>
              <p className="mt-1 text-muted">{feedback.specificity}</p>
            </div>
          </div>
          {feedback.improve.length > 0 && (
            <div className="text-sm">
              <p className="font-semibold">What to change</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                {feedback.improve.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="rounded-lg border border-border p-3 text-sm">
            <p className="font-semibold">A stronger version, built from your own experience</p>
            <p className="mt-1 whitespace-pre-wrap">{feedback.sample_answer}</p>
            <p className="mt-2 text-xs text-muted">Anything in square brackets is for you to fill in. Only say what is true.</p>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">{note ?? "Your answer is saved. Coaching feedback needs the AI features to be set up."}</p>
      )}
    </div>
  );
}
