import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  CircleDot,
  FileDiff,
  GraduationCap,
  RefreshCw,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAllRuns } from '../hooks/useAgentRuns';
import { useProjectMilestones } from '../hooks/useProjectMilestones';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  Checkbox,
  EmptyState,
  Field,
  Message,
  PageHeader,
  Select,
  Slider,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from '../components/ui';
import { MarkdownContent } from '../components/chat/MarkdownContent';
import { projectsApi } from '../lib/api/projects';

const EMPTY_CHECK_IN = {
  completed_work: '',
  in_progress: '',
  blockers: '',
  next_week_goal: '',
  confidence: '3',
};

const CONFIDENCE_LABELS = {
  1: 'Not confident',
  2: 'Slightly confident',
  3: 'Somewhat confident',
  4: 'Confident',
  5: 'Very confident',
};

const TABS = [
  { key: 'checkin', label: 'Weekly check-in', icon: CalendarCheck },
  { key: 'risks', label: 'Risk register', icon: ShieldAlert },
];

function severityTone(risk) {
  const order = { high: 3, medium: 2, low: 1 };
  const level = Math.max(order[risk.likelihood] || 0, order[risk.impact] || 0);
  if (level === 3) return { tone: 'danger', label: 'Severe' };
  if (level === 2) return { tone: 'warning', label: 'Moderate' };
  return { tone: 'success', label: 'Minor' };
}

export default function Tasks() {
  const { studentId } = useAuth();
  const toast = useToast();
  const { projects, loading, error: projectsError, refetch: refetchProjects } = useProjects(studentId);
  const { runs, error: runsError, refetch: refetchRuns } = useAllRuns(studentId);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [notice, setNotice] = useState(null);
  const [tab, setTab] = useState('checkin');

  const [risks, setRisks] = useState([]);
  const [risksProjectId, setRisksProjectId] = useState('');
  const [risksLoading, setRisksLoading] = useState(false);
  const [assessingRisks, setAssessingRisks] = useState(false);
  const [riskError, setRiskError] = useState('');

  const [checkIns, setCheckIns] = useState([]);
  const [checkInsProjectId, setCheckInsProjectId] = useState('');
  const [checkInsLoading, setCheckInsLoading] = useState(false);
  const [savingCheckIn, setSavingCheckIn] = useState(false);
  const [checkInError, setCheckInError] = useState('');
  const [checkInForm, setCheckInForm] = useState(EMPTY_CHECK_IN);

  const [planProposals, setPlanProposals] = useState([]);
  const [planProposalsProjectId, setPlanProposalsProjectId] = useState('');
  const [planProposalsLoading, setPlanProposalsLoading] = useState(false);
  const [planProposalError, setPlanProposalError] = useState('');
  const [planProposalsLoadError, setPlanProposalsLoadError] = useState(false);
  const [creatingProposalFor, setCreatingProposalFor] = useState(null);
  const [decidingProposalId, setDecidingProposalId] = useState(null);

  const projectId = projects.some((project) => String(project.id) === String(selectedProjectId))
    ? selectedProjectId
    : projects[0]
      ? String(projects[0].id)
      : '';

  const {
    milestones,
    loading: milestonesLoading,
    error: milestonesError,
    refetch: refetchMilestones,
    updateMilestone,
  } = useProjectMilestones(projectId);

  const latestRun = useMemo(
    () =>
      [...runs]
        .filter((run) => String(run.project_id) === String(projectId))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0],
    [runs, projectId],
  );
  const selectedProject = projects.find((project) => String(project.id) === String(projectId));
  const projectRisks = risksProjectId === String(projectId) ? risks : [];
  const projectCheckIns = checkInsProjectId === String(projectId) ? checkIns : [];
  const projectPlanProposals = planProposalsProjectId === String(projectId) ? planProposals : [];

  /* ---- data loading (unchanged logic) ---------------------------------- */
  const refreshRisks = useCallback(async () => {
    if (!projectId) return;
    setRisksLoading(true);
    setRiskError('');
    try {
      setRisks(await projectsApi.risks(projectId));
      setRisksProjectId(String(projectId));
    } catch (error) {
      setRisks([]);
      setRisksProjectId(String(projectId));
      setRiskError(error.message || 'Could not load project risks.');
    } finally {
      setRisksLoading(false);
    }
  }, [projectId]);

  const refreshCheckIns = useCallback(async () => {
    if (!projectId) return;
    setCheckInsLoading(true);
    setCheckInError('');
    try {
      setCheckIns(await projectsApi.checkIns(projectId));
      setCheckInsProjectId(String(projectId));
    } catch (error) {
      setCheckIns([]);
      setCheckInsProjectId(String(projectId));
      setCheckInError(error.message || 'Could not load project check-ins.');
    } finally {
      setCheckInsLoading(false);
    }
  }, [projectId]);

  const refreshPlanProposals = useCallback(async () => {
    if (!projectId) return;
    setPlanProposalsLoading(true);
    setPlanProposalError('');
    try {
      setPlanProposals(await projectsApi.planProposals(projectId));
      setPlanProposalsProjectId(String(projectId));
      setPlanProposalsLoadError(false);
    } catch (error) {
      setPlanProposals([]);
      setPlanProposalsProjectId(String(projectId));
      setPlanProposalsLoadError(true);
      setPlanProposalError(error.message || 'Could not load plan proposals.');
    } finally {
      setPlanProposalsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return undefined;
    let active = true;
    projectsApi
      .checkIns(projectId)
      .then((items) => {
        if (active) {
          setCheckIns(items);
          setCheckInsProjectId(String(projectId));
          setCheckInError('');
        }
      })
      .catch((error) => {
        if (active) {
          setCheckIns([]);
          setCheckInsProjectId(String(projectId));
          setCheckInError(error.message || 'Could not load project check-ins.');
        }
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return undefined;
    let active = true;
    projectsApi
      .planProposals(projectId)
      .then((items) => {
        if (active) {
          setPlanProposals(items);
          setPlanProposalsProjectId(String(projectId));
          setPlanProposalsLoadError(false);
          setPlanProposalError('');
        }
      })
      .catch((error) => {
        if (active) {
          setPlanProposals([]);
          setPlanProposalsProjectId(String(projectId));
          setPlanProposalsLoadError(true);
          setPlanProposalError(error.message || 'Could not load plan proposals.');
        }
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return undefined;
    let active = true;
    projectsApi
      .risks(projectId)
      .then((items) => {
        if (active) {
          setRisks(items);
          setRisksProjectId(String(projectId));
          setRiskError('');
        }
      })
      .catch((error) => {
        if (active) {
          setRisks([]);
          setRisksProjectId(String(projectId));
          setRiskError(error.message || 'Could not load project risks.');
        }
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  useEffect(() => {
    if (latestRun?.status === 'completed') {
      refetchMilestones().catch(() => {});
    }
  }, [latestRun?.id, latestRun?.status, refetchMilestones]);

  /* ---- handlers (unchanged logic) -------------------------------------- */
  const handleToggle = async (milestone, completed) => {
    setNotice(null);
    try {
      await updateMilestone(milestone, completed);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleAssessRisks = async () => {
    if (!projectId) return;
    setAssessingRisks(true);
    setRiskError('');
    try {
      setRisks(await projectsApi.assessRisks(projectId));
      setRisksProjectId(String(projectId));
      toast.success('The risk register has been refreshed for this project.');
    } catch (error) {
      setRiskError(error.message || 'Risk assessment could not be completed.');
    } finally {
      setAssessingRisks(false);
    }
  };

  const handleRiskStatus = async (risk, nextStatus) => {
    setRiskError('');
    try {
      const updated = await projectsApi.updateRisk(projectId, risk.id, { status: nextStatus });
      setRisks((previous) => previous.map((item) => (item.id === risk.id ? updated : item)));
    } catch (error) {
      setRiskError(error.message || 'Could not update risk status.');
    }
  };

  const handleCheckInChange = (event) => {
    const { name, value } = event.target;
    setCheckInForm((current) => ({ ...current, [name]: value }));
  };

  const handleCheckInSubmit = async (event) => {
    event.preventDefault();
    if (!projectId) return;
    setSavingCheckIn(true);
    setCheckInError('');
    try {
      const saved = await projectsApi.createCheckIn(projectId, {
        ...checkInForm,
        confidence: Number(checkInForm.confidence),
      });
      setCheckIns((current) => [saved, ...current]);
      setCheckInsProjectId(String(projectId));
      setCheckInForm(EMPTY_CHECK_IN);
      toast.success('Your mentor reviewed the update. Feedback is below.', 'Check-in saved');
    } catch (error) {
      setCheckInError(error.message || 'Could not submit the weekly check-in.');
    } finally {
      setSavingCheckIn(false);
    }
  };

  const handleCreatePlanProposal = async (checkInId) => {
    setCreatingProposalFor(checkInId);
    setPlanProposalError('');
    setPlanProposalsLoadError(false);
    try {
      const proposal = await projectsApi.createPlanProposal(projectId, checkInId);
      setPlanProposals((current) => [proposal, ...current]);
      setPlanProposalsProjectId(String(projectId));
    } catch (error) {
      setPlanProposalError(error.message || 'Could not draft a plan proposal.');
    } finally {
      setCreatingProposalFor(null);
    }
  };

  const handlePlanProposalDecision = async (proposal, decision) => {
    setDecidingProposalId(proposal.id);
    setPlanProposalError('');
    setPlanProposalsLoadError(false);
    try {
      const updated = await projectsApi.decidePlanProposal(projectId, proposal.id, decision);
      setPlanProposals((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      if (decision === 'approve') {
        setPlanProposals(await projectsApi.planProposals(projectId));
        await refetchMilestones();
        toast.success('Your plan now reflects the approved milestones.');
      }
    } catch (error) {
      setPlanProposalError(error.message || 'Could not update the plan proposal.');
      try {
        setPlanProposals(await projectsApi.planProposals(projectId));
        setPlanProposalsProjectId(String(projectId));
        setPlanProposalsLoadError(false);
      } catch (refreshError) {
        setPlanProposalsLoadError(true);
        setPlanProposalError(
          `${error.message || 'Could not update the plan proposal.'} ${refreshError.message || 'Proposal status could not be refreshed.'}`,
        );
      }
    } finally {
      setDecidingProposalId(null);
    }
  };

  /* ---- derived --------------------------------------------------------- */
  const completedCount = milestones.filter((m) => m.completed).length;
  const progress = milestones.length ? Math.round((completedCount / milestones.length) * 100) : 0;
  const openRisks = projectRisks.filter((r) => r.status === 'open').length;

  return (
    <>
      <PageHeader
        eyebrow="Milestones"
        title="Your plan, week by week"
        subtitle="Milestones come straight from the saved blueprint. Check them off, log a weekly update, and let the mentor keep score."
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              refetchMilestones();
              refreshCheckIns();
              refreshRisks();
            }}
          >
            Refresh
          </Button>
        }
      />

      {(projectsError || runsError || milestonesError || notice?.text) && (
        <Message type="error" className="my-4">
          {notice?.text || projectsError || runsError || milestonesError}
          <button
            type="button"
            onClick={() =>
              Promise.allSettled([refetchProjects(), refetchRuns(), refetchMilestones()])
            }
            className="ml-2 cursor-pointer bg-transparent p-0 font-bold underline"
          >
            Retry
          </button>
        </Message>
      )}

      {projects.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          eyebrow="Nothing to track"
          title="Milestones come from a blueprint"
          message="Create a project and run an analysis. The ordered, checkable plan appears here automatically."
        />
      ) : (
        <>
          {/* Project selector + faculty feedback */}
          <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
            <Card variant="inset">
              <div className="flex flex-wrap items-end gap-4">
                <Field label="Project" htmlFor="tasks-project" className="min-w-56 flex-1">
                  <Select
                    id="tasks-project"
                    value={projectId}
                    onChange={(event) => setSelectedProjectId(event.target.value)}
                  >
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.title}
                      </option>
                    ))}
                  </Select>
                </Field>
                <dl className="flex flex-wrap items-center gap-5 pb-1">
                  <div>
                    <dt className="eyebrow">Milestones</dt>
                    <dd className="mt-0.5 font-display text-[20px] leading-none font-semibold text-ink tabular">
                      {completedCount}/{milestones.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Plan complete</dt>
                    <dd className="mt-0.5 font-display text-[20px] leading-none font-semibold text-ink tabular">
                      {progress}%
                    </dd>
                  </div>
                  <div>
                    <dt className="eyebrow">Open risks</dt>
                    <dd className="mt-0.5 font-display text-[20px] leading-none font-semibold text-ink tabular">
                      {openRisks}
                    </dd>
                  </div>
                </dl>
              </div>
            </Card>

            {selectedProject?.faculty_evaluation ? (
              <Card variant="ochre">
                <CardHeader
                  icon={GraduationCap}
                  title="Faculty feedback"
                  subtitle={new Date(
                    selectedProject.faculty_evaluation.evaluated_at,
                  ).toLocaleDateString()}
                />
                <CardBody>
                  <p className="font-display text-[26px] leading-none font-semibold text-brand-700 tabular">
                    {selectedProject.faculty_evaluation.score}
                    <span className="font-sans text-[13px] font-semibold text-ink-faint"> / 100</span>
                  </p>
                  <p className="mt-2.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-soft">
                    {selectedProject.faculty_evaluation.feedback}
                  </p>
                </CardBody>
              </Card>
            ) : (
              <Card variant="inset">
                <CardBody className="flex h-full flex-col justify-center">
                  <p className="eyebrow">Faculty feedback</p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">
                    None yet. Once your supervisor scores this project it lands here — and only
                    here.
                  </p>
                </CardBody>
              </Card>
            )}
          </div>

          {/* Milestones + panels */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
            {/* Milestone timeline */}
            <Card>
              <CardHeader
                icon={ClipboardList}
                title="Saved milestones"
                subtitle="Checkable steps from your blueprint. Order is preserved."
                actions={
                  <span className="text-[12px] text-ink-muted tabular">
                    {completedCount} of {milestones.length} done
                  </span>
                }
              />
              {loading || milestonesLoading ? (
                <CardBody className="flex flex-col gap-3">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="size-4.5 rounded" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-3.5 w-2/5" />
                        <Skeleton className="h-3 w-4/5" />
                      </div>
                    </div>
                  ))}
                </CardBody>
              ) : milestones.length === 0 ? (
                <CardBody>
                  <EmptyState
                    icon={CircleDot}
                    eyebrow="Milestones"
                    title={
                      latestRun?.status === 'running' || latestRun?.status === 'queued'
                        ? 'Being written right now'
                        : 'No milestones yet'
                    }
                    message={
                      latestRun?.status === 'running' || latestRun?.status === 'queued'
                        ? 'The planning agent is drafting them. This page fills in as soon as the analysis finishes.'
                        : 'Run an analysis for this project and the ordered plan appears here.'
                    }
                    mood={
                      latestRun?.status === 'running' || latestRun?.status === 'queued'
                        ? 'locked'
                        : 'first-run'
                    }
                  />
                </CardBody>
              ) : (
                <CardBody>
                  <div className="mb-4">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle-strong">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-700 transition-[width] duration-700 ease-out"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  <ol className="relative flex flex-col">
                    {/* Timeline spine */}
                    <span
                      aria-hidden="true"
                      className="absolute top-2 bottom-2 left-[9px] w-px bg-line"
                    />
                    {milestones.map((milestone) => (
                      <li key={milestone.id} className="relative flex gap-3.5 py-3">
                        <span className="relative z-10 mt-0.5 shrink-0">
                          <Checkbox
                            checked={Boolean(milestone.completed)}
                            onChange={(event) =>
                              handleToggle(milestone, event.target.checked)
                            }
                            aria-label={`Mark ${milestone.title} ${milestone.completed ? 'incomplete' : 'complete'}`}
                            className="size-5"
                          />
                        </span>
                        <div className="min-w-0">
                          <p
                            className={`text-[14px] font-semibold transition-colors ${
                              milestone.completed ? 'text-ink-faint line-through' : 'text-ink'
                            }`}
                          >
                            <span className="mr-1.5 text-[12px] font-bold text-ochare-600 tabular">
                              {String(milestone.position).padStart(2, '0')}
                            </span>
                            {milestone.title}
                          </p>
                          {milestone.description && (
                            <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
                              {milestone.description}
                            </p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardBody>
              )}
            </Card>

            {/* Tabs: check-in / risks */}
            <div className="flex flex-col gap-5">
              <div
                className="flex gap-1.5 rounded-xl border border-line bg-subtle/60 p-1"
                role="tablist"
                aria-label="Project tools"
              >
                {TABS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      role="tab"
                      aria-selected={tab === item.key}
                      onClick={() => setTab(item.key)}
                      className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] px-3 py-2 text-[13px] font-semibold transition-colors ${
                        tab === item.key
                          ? 'bg-surface text-ink shadow-1'
                          : 'text-ink-muted hover:text-ink-soft'
                      }`}
                    >
                      <Icon size={14} aria-hidden="true" />
                      {item.label}
                      {item.key === 'risks' && openRisks > 0 && (
                        <span className="rounded-full bg-danger-100 px-1.5 text-[11px] font-bold text-danger-700 tabular">
                          {openRisks}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {tab === 'risks' ? (
                <Card>
                  <CardHeader
                    icon={ShieldAlert}
                    title="Risk register"
                    subtitle="What could sink delivery, and what to do about it."
                    actions={
                      <Button
                        size="sm"
                        onClick={handleAssessRisks}
                        loading={assessingRisks}
                        disabled={risksLoading || risksProjectId !== String(projectId)}
                      >
                        {projectRisks.length ? 'Reassess' : 'Assess risks'}
                      </Button>
                    }
                  />
                  <CardBody>
                    {riskError && (
                      <div className="mb-4">
                        <Message type="error">{riskError}</Message>
                        <button
                          type="button"
                          onClick={refreshRisks}
                          className="mt-2 cursor-pointer bg-transparent p-0 text-[13px] font-semibold text-brand-700 underline"
                        >
                          Retry loading risks
                        </button>
                      </div>
                    )}
                    {risksLoading || risksProjectId !== String(projectId) ? (
                      <div className="flex flex-col gap-3">
                        {[0, 1, 2].map((i) => (
                          <Skeleton key={i} className="h-20 w-full rounded-xl" />
                        ))}
                      </div>
                    ) : projectRisks.length === 0 ? (
                      riskError ? null : (
                        <EmptyState
                          icon={ShieldAlert}
                          eyebrow="Risk register"
                          title="No risks assessed yet"
                          message="The risk agent reads your blueprint and writes down what could go wrong — with mitigation you can actually act on."
                        />
                      )
                    ) : (
                      <ol className="flex flex-col gap-3">
                        {projectRisks.map((risk) => (
                          <li
                            key={risk.id}
                            className="rounded-xl border border-line bg-inset p-4"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-[14px] font-semibold text-ink">
                                    {risk.title}
                                  </h3>
                                  {(() => {
                                    const severity = severityTone(risk);
                                    return (
                                      <Badge tone={severity.tone}>{severity.label}</Badge>
                                    );
                                  })()}
                                  <StatusBadge status={risk.status} map="risk" />
                                </div>
                                <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                                  {risk.description}
                                </p>
                                <p className="mt-2.5 rounded-lg bg-subtle px-3 py-2 text-[13px] leading-relaxed text-ink-soft">
                                  <span className="font-semibold text-ink">Mitigation:</span>{' '}
                                  {risk.mitigation}
                                </p>
                                <p className="mt-2 text-[12px] text-ink-muted">
                                  Likelihood {risk.likelihood} · Impact {risk.impact}
                                </p>
                              </div>
                              <label className="w-full shrink-0 sm:w-36">
                                <span className="sr-only">Risk status for {risk.title}</span>
                                <Select
                                  value={risk.status}
                                  onChange={(event) =>
                                    handleRiskStatus(risk, event.target.value)
                                  }
                                >
                                  <option value="open">Open</option>
                                  <option value="mitigated">Mitigated</option>
                                  <option value="accepted">Accepted</option>
                                </Select>
                              </label>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardHeader
                    icon={CalendarCheck}
                    title="Weekly check-in"
                    subtitle="Your mentor reviews it against your saved plan."
                  />
                  <CardBody>
                    {checkInError && (
                      <div className="mb-4">
                        <Message type="error">{checkInError}</Message>
                        {checkInsProjectId !== String(projectId) && (
                          <button
                            type="button"
                            onClick={refreshCheckIns}
                            className="mt-2 cursor-pointer bg-transparent p-0 text-[13px] font-semibold text-brand-700 underline"
                          >
                            Retry loading check-ins
                          </button>
                        )}
                      </div>
                    )}

                    <form onSubmit={handleCheckInSubmit} className="flex flex-col gap-4">
                      <Field label="Completed this week" htmlFor="ci-completed">
                        <Textarea
                          id="ci-completed"
                          name="completed_work"
                          rows={2}
                          maxLength={3000}
                          required
                          value={checkInForm.completed_work}
                          onChange={handleCheckInChange}
                          placeholder="What you actually finished"
                        />
                      </Field>
                      <Field label="Working on now" htmlFor="ci-progress">
                        <Textarea
                          id="ci-progress"
                          name="in_progress"
                          rows={2}
                          maxLength={3000}
                          required
                          value={checkInForm.in_progress}
                          onChange={handleCheckInChange}
                          placeholder="What is mid-flight"
                        />
                      </Field>
                      <Field label="Blockers" htmlFor="ci-blockers" hint="Optional.">
                        <Textarea
                          id="ci-blockers"
                          name="blockers"
                          rows={2}
                          maxLength={3000}
                          value={checkInForm.blockers}
                          onChange={handleCheckInChange}
                          placeholder="What is in your way, if anything"
                        />
                      </Field>
                      <Field label="Goal for next week" htmlFor="ci-goal">
                        <Textarea
                          id="ci-goal"
                          name="next_week_goal"
                          rows={2}
                          maxLength={2000}
                          required
                          value={checkInForm.next_week_goal}
                          onChange={handleCheckInChange}
                          placeholder="One realistic outcome"
                        />
                      </Field>

                      <div>
                        <div className="mb-1.5 flex items-baseline justify-between">
                          <label
                            htmlFor="ci-confidence"
                            className="text-[13px] font-semibold text-ink-soft"
                          >
                            Confidence in this plan
                          </label>
                          <span className="text-[12px] font-semibold text-brand-700">
                            {checkInForm.confidence} —{' '}
                            {CONFIDENCE_LABELS[checkInForm.confidence]}
                          </span>
                        </div>
                        <Slider
                          id="ci-confidence"
                          name="confidence"
                          min="1"
                          max="5"
                          step="1"
                          value={checkInForm.confidence}
                          onChange={handleCheckInChange}
                        />
                      </div>

                      <Button type="submit" loading={savingCheckIn} block icon={Sparkles}>
                        {savingCheckIn ? 'Sending to your mentor…' : 'Submit check-in'}
                      </Button>
                    </form>
                  </CardBody>
                </Card>
              )}
            </div>
          </div>

          {/* Check-in history + plan proposals */}
          <Card className="mt-5">
            <CardHeader
              icon={CalendarCheck}
              title="Check-in history"
              subtitle="Every update you have sent, with the mentor's reply and any plan changes."
            />
            <CardBody>
              {planProposalError && (
                <div className="mb-4">
                  <Message type="error">{planProposalError}</Message>
                  {planProposalsLoadError && (
                    <button
                      type="button"
                      onClick={refreshPlanProposals}
                      className="mt-2 cursor-pointer bg-transparent p-0 text-[13px] font-semibold text-brand-700 underline"
                    >
                      Retry loading proposals
                    </button>
                  )}
                </div>
              )}

              {checkInsLoading || checkInsProjectId !== String(projectId) ? (
                <div className="flex flex-col gap-3">
                  {[0, 1].map((i) => (
                    <Skeleton key={i} className="h-28 w-full rounded-xl" />
                  ))}
                </div>
              ) : projectCheckIns.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck}
                  eyebrow="History"
                  title="No check-ins yet"
                  message="Send your first weekly update. Your mentor answers it against the plan you saved — not generic advice."
                />
              ) : (
                <ol className="flex flex-col gap-4">
                  {projectCheckIns.map((checkIn) => {
                    const proposal = projectPlanProposals.find(
                      (item) => item.check_in_id === checkIn.id,
                    );
                    return (
                      <li
                        key={checkIn.id}
                        className="rounded-xl border border-line bg-inset p-5"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="text-[12px] font-semibold text-ink-muted">
                            {new Date(checkIn.created_at).toLocaleString()}
                          </span>
                          <Badge tone="brand">Confidence {checkIn.confidence}/5</Badge>
                        </div>

                        <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                          {[
                            ['Completed', checkIn.completed_work],
                            ['In progress', checkIn.in_progress],
                            ['Blockers', checkIn.blockers],
                            ['Next week', checkIn.next_week_goal],
                          ]
                            .filter(([, value]) => Boolean(value))
                            .map(([label, value]) => (
                              <div key={label}>
                                <dt className="eyebrow">{label}</dt>
                                <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-soft">
                                  {value}
                                </dd>
                              </div>
                            ))}
                        </dl>

                        <div className="mt-4 rounded-xl border border-brand-100 bg-brand-50/60 p-4">
                          <p className="eyebrow eyebrow-accent">AI mentor feedback</p>
                          <div className="mt-1.5">
                            <MarkdownContent content={checkIn.mentor_feedback} compact />
                          </div>
                        </div>

                        {proposal ? (
                          <div className="mt-4 rounded-xl border border-ochare-200/70 bg-ochare-50/60 p-4">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                                <FileDiff size={15} className="text-ochare-600" aria-hidden="true" />
                                Suggested plan adjustment
                              </p>
                              <StatusBadge status={proposal.status} map="proposal" />
                            </div>
                            <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">
                              {proposal.rationale}
                            </p>

                            {proposal.current_milestones?.length > 0 && (
                              <div className="mt-3">
                                <p className="eyebrow">Current milestones at draft time</p>
                                <ul className="mt-1 flex flex-wrap gap-1.5">
                                  {proposal.current_milestones.map((milestone) => (
                                    <li
                                      key={milestone.id}
                                      className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] text-ink-muted"
                                    >
                                      {milestone.completed ? (
                                        <CheckCircle2
                                          size={11}
                                          className="text-success-500"
                                          aria-hidden="true"
                                        />
                                      ) : (
                                        <CircleDot size={11} className="text-ink-faint" aria-hidden="true" />
                                      )}
                                      {milestone.title}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            <p className="mt-3.5 text-[12px] leading-relaxed text-ink-muted">
                              Approving replaces only unfinished milestones — completed work is
                              preserved, and the proposal is refused if the plan changed after it
                              was drafted.
                            </p>

                            <ol className="mt-2.5 flex flex-col gap-1.5">
                              {proposal.milestones.map((milestone, index) => (
                                <li
                                  key={`${proposal.id}-${index}`}
                                  className="flex gap-2 text-[13px] leading-relaxed text-ink-soft"
                                >
                                  <span className="font-bold text-ochare-600 tabular">
                                    {index + 1}.
                                  </span>
                                  <span>
                                    <span className="font-semibold text-ink">
                                      {milestone.title}:
                                    </span>{' '}
                                    {milestone.description}
                                  </span>
                                </li>
                              ))}
                            </ol>

                            {proposal.status === 'pending' && (
                              <div className="mt-4 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handlePlanProposalDecision(proposal, 'approve')}
                                  loading={decidingProposalId === proposal.id}
                                  disabled={decidingProposalId !== null}
                                >
                                  Approve and update plan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => handlePlanProposalDecision(proposal, 'reject')}
                                  loading={decidingProposalId === proposal.id}
                                  disabled={decidingProposalId !== null}
                                >
                                  Reject proposal
                                </Button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-4">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleCreatePlanProposal(checkIn.id)}
                              loading={
                                creatingProposalFor === checkIn.id || planProposalsLoading
                              }
                              disabled={
                                creatingProposalFor !== null ||
                                planProposalsProjectId !== String(projectId)
                              }
                            >
                              Draft plan adjustment
                            </Button>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardBody>
          </Card>
        </>
      )}
    </>
  );
}
