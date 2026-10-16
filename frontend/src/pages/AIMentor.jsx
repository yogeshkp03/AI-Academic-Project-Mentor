import { useEffect, useMemo, useState } from 'react';
import {
  Bot,
  FileText,
  MessageSquarePlus,
  MessagesSquare,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns } from '../hooks/useAgentRuns';
import { useConversations, useMessages } from '../hooks/useConversations';
import { AgentPicker } from '../components/chat/AgentPicker';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatThread } from '../components/chat/ChatThread';
import { MessageComposer } from '../components/chat/MessageComposer';
import { AnalysisHistory } from '../components/chat/AnalysisHistory';
import { WORKSPACE_REFRESH_MS } from '../config';
import {
  Button,
  ButtonLink,
  Card,
  CardBody,
  CardHeader,
  ConfirmDialog,
  EmptyState,
  Field,
  Input,
  Message,
  Modal,
  PageHeader,
  useToast,
} from '../components/ui';
import { isActiveStatus } from '../lib/format';
import { downloadRunReport } from '../lib/reportExport';

const MENTOR = {
  name: 'AI Mentor',
  role: 'Capstone supervisor who has read your blueprint',
  avatar: 'M',
};

/** Display names for the specialist conversation types. */
const SPECIALIST_LABELS = {
  feasibility: 'Feasibility Agent',
  architect: 'Architect Agent',
  scope: 'Scope Agent',
  timeline: 'Timeline Agent',
  ui_ux: 'UI/UX Agent',
  planning: 'Planning Agent',
  professor: 'Professor QA',
  resource: 'Resource Agent',
};

export default function AIMentor() {
  const { studentId } = useAuth();
  const toast = useToast();
  const { projects, error: projectsError, refetch: refetchProjects } = useProjects(studentId);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [activePanel, setActivePanel] = useState('mentor');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmPlanUpdate, setConfirmPlanUpdate] = useState(false);

  const activeProjectId = projects.some((project) => String(project.id) === String(selectedProjectId))
    ? selectedProjectId
    : projects[0]
      ? String(projects[0].id)
      : '';

  const {
    conversations,
    error: conversationsError,
    refetch: refetchConversations,
    createConversation,
    renameConversation,
    deleteConversation,
  } = useConversations(activeProjectId);
  const {
    messages,
    error: messagesError,
    sendMessage,
    refetch: refetchMessages,
  } = useMessages(selectedConversationId);
  const {
    runs,
    error: runsError,
    refetch: refetchRuns,
    startAnalysis,
    startConversationAnalysis,
  } = useAgentRuns(activeProjectId);

  const activeConversation = conversations.find(
    (conversation) => String(conversation.id) === String(selectedConversationId),
  );
  const conversationLabel = activeConversation?.agent_type
    ? SPECIALIST_LABELS[activeConversation.agent_type] || 'AI Mentor'
    : MENTOR.name;

  const runStatus = useMemo(() => {
    const active = runs.filter((run) => isActiveStatus(run.status));
    if (active.length > 0) return { state: 'working', label: `${active.length} running` };
    const failed = runs.filter((run) => run.status === 'failed');
    if (failed.length === runs.length && runs.length > 0) {
      return { state: 'failed', label: 'Last run failed' };
    }
    return { state: 'done', label: 'All saved' };
  }, [runs]);

  useEffect(() => {
    const hasActiveRun = runs.some((run) => isActiveStatus(run.status));
    if (!hasActiveRun || !activeProjectId) return undefined;
    const interval = setInterval(() => {
      refetchRuns().catch((error) => {
        setNotice({ type: 'error', text: `Could not refresh analysis status: ${error.message}` });
      });
    }, WORKSPACE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [runs, activeProjectId, refetchRuns]);

  const handleNewChat = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setNotice(null);
    try {
      const conversation = await createConversation({
        agent_type: 'mentor',
        title: 'AI Mentor discussion',
      });
      setSelectedConversationId(String(conversation.id));
      setActivePanel('mentor');
      toast.success('The mentor has your saved reports to hand. Ask away.');
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (text) => {
    if (!selectedConversationId) return;
    setLoading(true);
    setNotice(null);
    try {
      await sendMessage(text);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const openRename = (conversation) => {
    setRenameTarget(conversation);
    setRenameDraft(conversation.title);
  };

  const submitRename = async () => {
    if (!renameTarget) return;
    const title = renameDraft.trim();
    if (!title) return;
    try {
      await renameConversation(renameTarget.id, title);
      setRenameTarget(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteConversation(deleteTarget);
      if (String(deleteTarget) === String(selectedConversationId)) {
        setSelectedConversationId('');
      }
      setDeleteTarget(null);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(String(conversationId));
    setActivePanel('mentor');
  };

  const handleRetryAnalysis = async () => {
    if (!activeProjectId) return;
    setNotice(null);
    try {
      await startAnalysis(activeProjectId);
      setSelectedRunId(null);
      setActivePanel('feasibility');
      toast.info('A fresh run is queued. This page updates itself.', 'Analysis started');
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleUpdatePlanFromChat = async () => {
    if (!selectedConversationId) return;
    setLoading(true);
    setNotice(null);
    try {
      const run = await startConversationAnalysis(selectedConversationId);
      setConfirmPlanUpdate(false);
      setSelectedRunId(run.id);
      setActivePanel('feasibility');
      toast.info(`Version v${run.version} is queued using this mentor conversation.`, 'Plan update started');
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadRun = async (run, format) => {
    try {
      const projectTitle = projects.find(
        (project) => String(project.id) === String(activeProjectId),
      )?.title;
      await downloadRunReport(run, format, { projectTitle });
      toast.success(`Version v${run.version} downloaded as ${format.toUpperCase()}.`);
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const openReport = (run) => {
    const withOutput = run.steps?.find((step) => step.output);
    setSelectedRunId(run.id);
    setActivePanel(withOutput ? withOutput.step_key : 'feasibility');
  };

  return (
    <>
      <PageHeader
        eyebrow="AI Workspace"
        title="Talk to the team that wrote your plan"
        subtitle="Each specialist saved its own report. Open one, and ask it why it decided what it decided."
        actions={
          <>
            <ButtonLink to="/projects" variant="secondary" size="sm" icon={RefreshCw}>
              All projects
            </ButtonLink>
            <Button size="sm" icon={MessageSquarePlus} loading={loading} onClick={handleNewChat}>
              New mentor chat
            </Button>
          </>
        }
      />

      {notice?.text && (
        <Message type={notice.type} className="my-4">
          {notice.text}
        </Message>
      )}

      {(projectsError || runsError || conversationsError || messagesError) && (
        <Message type="warning" className="my-4">
          {projectsError?.message
            ? `Could not load projects: ${projectsError.message}`
            : runsError?.message
              ? `Could not load analysis history: ${runsError.message}`
              : conversationsError?.message
                ? `Could not load conversations: ${conversationsError.message}`
                : messagesError?.message
                  ? `Could not load messages: ${messagesError.message}`
                  : 'Something could not be loaded. Your work itself is safe.'}
          <button
            type="button"
            onClick={() =>
              Promise.allSettled([
                refetchProjects(),
                refetchRuns(),
                refetchConversations(),
                refetchMessages(),
              ])
            }
            className="ml-1 cursor-pointer bg-transparent p-0 font-bold underline"
          >
            Try again
          </button>
        </Message>
      )}

      <div className="mt-2">
        <AgentPicker
          projects={projects}
          selectedProjectId={activeProjectId}
          onProjectChange={(id) => {
            setSelectedProjectId(id);
            setSelectedConversationId('');
            setSelectedRunId(null);
            setActivePanel('feasibility');
          }}
          onNewChat={handleNewChat}
          busy={loading}
        />
      </div>

      {!activeProjectId ? (
        <Card className="mt-5">
          <CardBody>
            <EmptyState
              icon={MessagesSquare}
              eyebrow="Workspace"
              title={
                projectsError?.message
                  ? 'Projects could not be loaded'
                  : 'No project selected yet'
              }
              message={
                projectsError?.message ||
                'Create a project first, then run an analysis. The team only discusses work it has actually seen.'
              }
              action={
                projectsError ? (
                  <Button variant="secondary" onClick={() => refetchProjects()}>
                    Try again
                  </Button>
                ) : (
                  <ButtonLink to="/projects">Go to projects</ButtonLink>
                )
              }
            />
          </CardBody>
        </Card>
      ) : (
        <div className="mt-5 grid gap-5 lg:h-[min(72vh,780px)] lg:min-h-[460px] lg:grid-cols-[minmax(250px,0.36fr)_minmax(0,0.64fr)]">
          {/* Left rail */}
          <div className="grid min-h-0 min-w-0 gap-5 lg:grid-rows-[auto_minmax(0,1fr)]">
            <Card>
              <CardHeader
                icon={MessagesSquare}
                title="Conversations"
                subtitle={`${conversations.length} saved with this project`}
                actions={
                  <Button
                    size="xs"
                    variant="subtle"
                    icon={MessageSquarePlus}
                    onClick={handleNewChat}
                    loading={loading}
                  >
                    New
                  </Button>
                }
              />
              <CardBody className="max-h-60 overflow-y-auto lg:max-h-none lg:flex-1">
                <ConversationList
                  conversations={conversations}
                  selectedId={selectedConversationId}
                  onSelect={handleSelectConversation}
                  onRename={openRename}
                  onDelete={setDeleteTarget}
                />
              </CardBody>
            </Card>

            <div className="grid min-h-0 min-w-0">
              <Card className="nice-scroll min-h-0 min-w-0 overflow-y-auto">
                <CardHeader
                  icon={Sparkles}
                  title="Analyses"
                  subtitle={
                    runStatus.state === 'working'
                      ? runStatus.label
                      : `${runs.length} saved version${runs.length === 1 ? '' : 's'}`
                  }
                />
                <CardBody>
                  <AnalysisHistory
                    runs={runs}
                    selectedRunId={selectedRunId}
                    onSelectRun={openReport}
                    onSelectLatest={() => {
                      const latestWithOutput = runs.find(
                        (run) => run.output || run.steps?.some((step) => step.output),
                      );
                      if (latestWithOutput) openReport(latestWithOutput);
                    }}
                    onRetry={handleRetryAnalysis}
                    onDownload={handleDownloadRun}
                    busy={loading}
                  />
                </CardBody>
              </Card>
            </div>
          </div>

          {/* Right: reports + mentor */}
          <Card className="flex h-[74vh] min-h-[420px] max-h-[900px] min-w-0 flex-col overflow-hidden lg:h-full">
            <div className="nice-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              <ChatThread
                messages={messages}
                runs={runs}
                selectedRunId={selectedRunId}
                onSelectRun={(id) => setSelectedRunId(Number(id))}
                activePanel={activePanel}
                onSelectPanel={setActivePanel}
                hasConversation={Boolean(selectedConversationId)}
                conversationLabel={conversationLabel}
                onNewChat={handleNewChat}
              />
            </div>

            {activePanel === 'mentor' && (
              <div className="shrink-0 border-t border-line px-5 py-4">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-full bg-brand-600 font-display text-[13px] font-semibold text-white">
                    {MENTOR.avatar}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-ink">Continue with {conversationLabel}</p>
                    <p className="truncate text-[11.5px] text-ink-muted">{MENTOR.role}</p>
                  </div>
                </div>
                <MessageComposer
                  onSend={handleSend}
                  disabled={!selectedConversationId}
                  busy={loading}
                />
                {activeConversation?.agent_type === 'mentor' && (
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11.5px] leading-relaxed text-ink-muted">
                      Create a new plan version from the saved discussion; older versions stay available.
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      icon={FileText}
                      onClick={() => setConfirmPlanUpdate(true)}
                      disabled={
                        loading
                        || !messages.some((message) => message.role === 'user')
                        || runs.some((item) => isActiveStatus(item.status))
                      }
                    >
                      Update plan from chat
                    </Button>
                  </div>
                )}
                {!selectedConversationId && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-ink-muted">
                    <Bot size={12} aria-hidden="true" />
                    Start a new AI Mentor chat, or pick a saved conversation on the left.
                  </p>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Rename dialog — replaces window.prompt */}
      <ConfirmDialog
        open={confirmPlanUpdate}
        onClose={() => setConfirmPlanUpdate(false)}
        onConfirm={handleUpdatePlanFromChat}
        title="Create an updated plan?"
        description="The AI team will use the saved messages in this mentor chat to create a new analysis version. Your existing plan and previous versions remain saved."
        confirmLabel="Create new plan version"
        cancelLabel="Cancel"
        tone="primary"
        icon={FileText}
        loading={loading}
      />

      <Modal
        open={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        title="Rename conversation"
        description="A name you will recognise later."
        icon={Pencil}
        footer={
          <>
            <Button variant="secondary" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={submitRename} disabled={!renameDraft.trim()}>
              Save
            </Button>
          </>
        }
      >
        <Field label="Title" htmlFor="rename-conversation">
          <Input
            id="rename-conversation"
            value={renameDraft}
            onChange={(event) => setRenameDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') submitRename();
            }}
            autoFocus
          />
        </Field>
      </Modal>

      {/* Delete conversation */}
      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this conversation?"
        description="The messages are removed from your account. Your project and its reports are untouched."
        icon={Trash2}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Keep it
            </Button>
            <Button variant="danger" icon={Trash2} onClick={confirmDelete}>
              Delete conversation
            </Button>
          </>
        }
      />
    </>
  );
}
