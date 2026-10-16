import { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Loader2,
  Target,
  Trophy,
} from 'lucide-react';
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  LoadingCover,
  Message,
  PageHeader,
  Skeleton,
} from '../components/ui';
import { authApi } from '../lib/api/auth';
import { skillAssessmentsApi } from '../lib/api/skillAssessments';
import { cn } from '../lib/cn';

// Same tone ladder the Profile page uses for skill levels, so a level reads
// the same colour wherever a student sees it.
const LEVEL_TONES = {
  Beginner: 'warning',
  Intermediate: 'info',
  Advanced: 'success',
};

export default function SkillAssessment() {
  const [skills, setSkills] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [attempt, setAttempt] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [error, setError] = useState('');

  const refresh = async () => {
    const [history, profile] = await Promise.all([
      skillAssessmentsApi.listAttempts(),
      authApi.me(),
    ]);
    setAttempts(history);
    setSkills(Array.isArray(profile.skills) ? profile.skills : []);
  };

  const resumeInto = (resumed) => {
    setResult(null);
    setAttempt(resumed);
    setAnswers(resumed.answers || {});
    const nextQuestionIndex = resumed.questions.findIndex(
      (question) => !resumed.answers?.[question.id],
    );
    setIndex(nextQuestionIndex < 0 ? resumed.questions.length - 1 : nextQuestionIndex);
  };

  useEffect(() => {
    let active = true;
    Promise.all([skillAssessmentsApi.listAttempts(), authApi.me()])
      .then(async ([history, profile]) => {
        if (!active) return;
        setAttempts(history);
        setSkills(Array.isArray(profile.skills) ? profile.skills : []);
        const activeAttempt = history.find((item) => item.status === 'in_progress');
        if (activeAttempt) {
          const resumed = await skillAssessmentsApi.resume(activeAttempt.id);
          if (!active) return;
          resumeInto(resumed);
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load assessment history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const start = async () => {
    setStarting(true);
    setError('');
    setResult(null);
    try {
      const started = await skillAssessmentsApi.start();
      setAttempt(started);
      setAnswers({});
      setIndex(0);
    } catch (startError) {
      setError(startError.message || 'Could not start the assessment.');
    } finally {
      setStarting(false);
    }
  };

  const submit = async () => {
    if (!attempt || Object.keys(answers).length !== attempt.questions.length) return;
    setSubmitting(true);
    setError('');
    try {
      const completed = await skillAssessmentsApi.submit(
        attempt.attempt_id,
        attempt.questions.map((question) => ({
          question_id: question.id,
          answer: answers[question.id],
        })),
      );
      setAttempt(null);
      setResult(completed);
      await refresh();
    } catch (submitError) {
      setError(submitError.message || 'Could not submit your assessment.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveAnswer = async (questionId, answer) => {
    setAnswers((previous) => ({ ...previous, [questionId]: answer }));
    setSavingDraft(true);
    setError('');
    try {
      await skillAssessmentsApi.saveDraft(attempt.attempt_id, [
        { question_id: questionId, answer },
      ]);
    } catch (draftError) {
      setError(
        draftError.message ||
          'Your answer could not be saved. Please select it again to retry.',
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const currentQuestion = attempt?.questions[index];
  const total = attempt?.questions.length || 0;
  const answeredCount = Object.keys(answers).length;
  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Skill check"
        title="Find the gaps before your code does"
        subtitle="A short, non-proctored quiz drawn from the skills in your profile. Scored by the server, saved to your history."
        actions={
          attempt ? (
            <Button
              variant="secondary"
              size="sm"
              icon={ArrowLeft}
              onClick={() => setAttempt(null)}
            >
              Leave quiz
            </Button>
          ) : null
        }
      />

      {error && (
        <Message type="error" className="my-4">
          {error}
        </Message>
      )}

      {loading ? (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <Card>
            <CardBody>
              <LoadingCover label="Loading your skills and history…" />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="flex flex-col gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </CardBody>
          </Card>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
          <section>
            {result && (
              <Card variant="ochre" className="mb-5 overflow-hidden">
                <CardBody>
                  <div className="flex flex-wrap items-center gap-6">
                    <span className="grid size-20 shrink-0 place-items-center rounded-full bg-surface shadow-2">
                      <span className="font-display text-[26px] font-semibold text-brand-700 tabular">
                        {result.score}%
                      </span>
                    </span>
                    <div className="min-w-0">
                      <p className="eyebrow eyebrow-accent">Assessment complete</p>
                      <h2 className="mt-1 font-display text-[20px] font-semibold text-ink">
                        {result.correct_answers} of {result.total_questions} correct
                      </h2>
                      <p className="mt-1.5 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
                        Answers were scored against the saved question bank. Review what you
                        missed in your profile skills — the plan you generated assumes them.
                      </p>
                      <Button
                        className="mt-3"
                        variant="secondary"
                        size="sm"
                        icon={Trophy}
                        onClick={() => setResult(null)}
                      >
                        Back to assessments
                      </Button>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {attempt && currentQuestion ? (
              <Card>
                <CardHeader
                  icon={Target}
                  title={`Question ${index + 1} of ${total}`}
                  subtitle={
                    savingDraft ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                        Saving your answer…
                      </span>
                    ) : (
                      `${answeredCount} of ${total} answered`
                    )
                  }
                  actions={
                    <span className="inline-flex items-center gap-1.5">
                      <Badge tone={LEVEL_TONES[currentQuestion.level] || 'neutral'}>
                        {currentQuestion.level}
                      </Badge>
                      <Badge tone="brand">{currentQuestion.skill}</Badge>
                    </span>
                  }
                />

                <CardBody>
                  <div className="mb-5 h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-[width] duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  {/* Question dots */}
                  <ol className="mb-6 flex flex-wrap gap-1.5">
                    {attempt.questions.map((question, i) => {
                      const done = Boolean(answers[question.id]);
                      const isCurrent = i === index;
                      return (
                        <li key={question.id}>
                          <button
                            type="button"
                            onClick={() => setIndex(i)}
                            aria-label={`Go to question ${i + 1}`}
                            aria-current={isCurrent}
                            className={cn(
                              'grid size-6 cursor-pointer place-items-center rounded-md border text-[11px] font-bold transition-colors',
                              isCurrent
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : done
                                  ? 'border-success-200 bg-success-50 text-success-700'
                                  : 'border-line bg-surface text-ink-faint hover:border-line-strong',
                            )}
                          >
                            {done ? <CheckCircle2 size={12} aria-hidden="true" /> : i + 1}
                          </button>
                        </li>
                      );
                    })}
                  </ol>

                  <h2 className="font-display text-[19px] leading-snug font-semibold text-ink">
                    {currentQuestion.question}
                  </h2>

                  <fieldset className="mt-5 flex flex-col gap-2.5">
                    <legend className="sr-only">Select an answer</legend>
                    {currentQuestion.options.map((option, optionIndex) => {
                      const selected = answers[currentQuestion.id] === option;
                      return (
                        <label
                          key={option}
                          className={cn(
                            'flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors',
                            selected
                              ? 'border-brand-500 bg-brand-50/70'
                              : 'border-line bg-inset hover:border-line-strong',
                          )}
                        >
                          <input
                            type="radio"
                            name={`question-${currentQuestion.id}`}
                            value={option}
                            checked={selected}
                            onChange={() => saveAnswer(currentQuestion.id, option)}
                            disabled={savingDraft}
                            className="sr-only"
                          />
                          <span
                            className={cn(
                              'grid size-6 shrink-0 place-items-center rounded-md border text-[12px] font-bold transition-colors',
                              selected
                                ? 'border-brand-600 bg-brand-600 text-white'
                                : 'border-line-strong bg-surface text-ink-muted',
                            )}
                          >
                            {String.fromCharCode(65 + optionIndex)}
                          </span>
                          <span className="text-[14px] leading-relaxed text-ink-soft">
                            {option}
                          </span>
                        </label>
                      );
                    })}
                  </fieldset>

                  <div className="mt-7 flex items-center justify-between gap-3">
                    <Button
                      variant="secondary"
                      icon={ArrowLeft}
                      disabled={index === 0 || submitting || savingDraft}
                      onClick={() => setIndex((previous) => previous - 1)}
                    >
                      Previous
                    </Button>
                    {index < total - 1 ? (
                      <Button
                        iconRight={ArrowRight}
                        disabled={!answers[currentQuestion.id] || submitting || savingDraft}
                        onClick={() => setIndex((previous) => previous + 1)}
                      >
                        Next question
                      </Button>
                    ) : (
                      <Button
                        loading={submitting}
                        disabled={answeredCount !== total || savingDraft}
                        onClick={submit}
                      >
                        Submit assessment
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card>
                <CardHeader
                  icon={BrainCircuit}
                  title="Ready when you are"
                  subtitle="Questions come from the skills you saved, so the result actually says something."
                />
                <CardBody>
                  {skills.length ? (
                    <>
                      <ul className="flex flex-wrap gap-2">
                        {skills.map((skill) => (
                          <li key={skill.name}>
                            <Badge tone="ochare">{skill.name}</Badge>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-4 text-[13.5px] leading-relaxed text-ink-muted">
                        Five questions, one attempt at a time. Your answers are saved as you go,
                        so closing the page does not lose progress.
                      </p>
                      <Button className="mt-5" loading={starting} onClick={start} icon={Target}>
                        Start assessment
                      </Button>
                    </>
                  ) : (
                    <EmptyState
                      icon={BrainCircuit}
                      eyebrow="Skill check"
                      title="Add a skill first"
                      message="Save at least one technical skill in your profile. The quiz is built from those, so an empty list would give you nothing useful to measure."
                      action={
                        <ButtonLink to="/profile" iconRight={ArrowRight}>
                          Update profile skills
                        </ButtonLink>
                      }
                    />
                  )}
                </CardBody>
              </Card>
            )}
          </section>

          {/* History */}
          <aside>
            <Card variant="inset">
              <CardHeader icon={Clock3} title="Recent attempts" />
              <CardBody>
                {attempts.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-ink-muted">
                    Completed assessments will appear here.
                  </p>
                ) : (
                  <ol className="flex flex-col gap-2.5">
                    {attempts.map((item) => {
                      const inProgress = item.status === 'in_progress' && !attempt;
                      return (
                        <li
                          key={item.id}
                          className="rounded-xl border border-line bg-surface p-3.5"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-display text-[19px] font-semibold text-ink tabular">
                              {item.score == null ? '—' : `${item.score}%`}
                            </span>
                            <span className="text-[11.5px] text-ink-muted">
                              {item.created_at
                                ? new Date(item.created_at).toLocaleDateString()
                                : ''}
                            </span>
                          </div>
                          <p className="mt-1 text-[12px] text-ink-muted tabular">
                            {item.correct_answers ?? '—'} / {item.total_questions} correct
                          </p>
                          <p className="mt-1.5 text-[12px] text-ink-soft">
                            {(item.skills || []).join(', ')}
                          </p>
                          {inProgress && (
                            <Button
                              size="sm"
                              variant="secondary"
                              block
                              className="mt-2.5"
                              onClick={async () => {
                                setError('');
                                try {
                                  const resumed = await skillAssessmentsApi.resume(item.id);
                                  resumeInto(resumed);
                                } catch (resumeError) {
                                  setError(
                                    resumeError.message || 'Could not resume this assessment.',
                                  );
                                }
                              }}
                            >
                              Resume assessment
                            </Button>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                )}
              </CardBody>
            </Card>
          </aside>
        </div>
      )}
    </>
  );
}
