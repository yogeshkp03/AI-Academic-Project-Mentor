import { useEffect, useState } from 'react';
import { useAuth } from '../context/useAuth';
import { useProjects } from '../hooks/useProjects';
import { useAgentRuns } from '../hooks/useAgentRuns';
import { useConversations, useMessages } from '../hooks/useConversations';
import { AgentPicker } from '../components/chat/AgentPicker';
import { ConversationList } from '../components/chat/ConversationList';
import { ChatThread } from '../components/chat/ChatThread';
import { MessageComposer } from '../components/chat/MessageComposer';
import { AnalysisHistory } from '../components/chat/AnalysisHistory';
import { AGENTS, WORKSPACE_REFRESH_MS } from '../config';
import { Card, EmptyState, Message, PageHeader } from '../components/ui';
import { isActiveStatus } from '../lib/format';

function AIMentor() {
  const { studentId } = useAuth();
  const { projects } = useProjects(studentId);

  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [agentType, setAgentType] = useState('mentor');
  const [selectedConversationId, setSelectedConversationId] = useState('');
  const [selectedRunReport, setSelectedRunReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);

  const activeProjectId = projects.some((project) => String(project.id) === String(selectedProjectId))
    ? selectedProjectId
    : projects[0]
      ? String(projects[0].id)
      : '';

  const { conversations, createConversation, renameConversation, deleteConversation } =
    useConversations(activeProjectId);
  const { messages, sendMessage, refetch: refetchMessages } = useMessages(selectedConversationId);
  const { runs, refetch: refetchRuns, startAnalysis } = useAgentRuns(activeProjectId);

  useEffect(() => {
    const hasActiveRun = runs.some((run) => isActiveStatus(run.status));
    if (!hasActiveRun || !activeProjectId) return undefined;

    const interval = setInterval(() => {
      refetchRuns().catch(() => {});
    }, WORKSPACE_REFRESH_MS);
    return () => clearInterval(interval);
  }, [runs, activeProjectId, refetchRuns]);

  const handleNewChat = async () => {
    if (!activeProjectId) return;
    setLoading(true);
    setNotice(null);
    try {
      const label = AGENTS.find((agent) => agent.key === agentType)?.label || 'AI Agent';
      const conversation = await createConversation({
        agent_type: agentType,
        title: `${label} discussion`,
      });
      setSelectedConversationId(String(conversation.id));
      await refetchMessages();
      setNotice({ type: 'success', text: 'New conversation created.' });
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

  const handleRename = async (conversation) => {
    const title = window.prompt('Conversation title', conversation.title);
    if (!title?.trim()) return;
    try {
      await renameConversation(conversation.id, title.trim());
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleDelete = async (conversationId) => {
    try {
      await deleteConversation(conversationId);
      setSelectedConversationId('');
      await refetchMessages();
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const handleSelectConversation = async (conversationId) => {
    setSelectedConversationId(String(conversationId));
    setSelectedRunReport('');
    await refetchMessages();
  };

  const handleRetryAnalysis = async () => {
    if (!activeProjectId) return;
    setNotice(null);
    try {
      await startAnalysis(activeProjectId);
      setSelectedRunReport('');
      setNotice({ type: 'info', text: 'A new analysis run has been queued.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  return (
    <>
      <PageHeader title="AI Workspace" subtitle="Continue project conversations with the right specialist." />

      {notice?.text && (
        <Message type={notice.type} className="mb-4" onDismiss={() => setNotice(null)}>
          {notice.text}
        </Message>
      )}

      <AgentPicker
        projects={projects}
        selectedProjectId={activeProjectId}
        agentType={agentType}
        onProjectChange={(id) => {
          setSelectedProjectId(id);
          setSelectedConversationId('');
          setSelectedRunReport('');
        }}
        onAgentChange={setAgentType}
        onNewChat={handleNewChat}
        busy={loading}
      />

      {!activeProjectId ? (
        <Card>
          <EmptyState icon="💬" title="No project selected" message="Create a project first to open an AI workspace." />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(220px,0.32fr)_minmax(0,1fr)]">
          <div className="grid content-start gap-5">
            <Card title="Conversations">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                onSelect={handleSelectConversation}
                onRename={handleRename}
                onDelete={handleDelete}
              />
            </Card>
            <Card>
              <AnalysisHistory
                runs={runs}
                selectedReport={selectedRunReport}
                onSelectRun={(run) => {
                  if (run.output) setSelectedRunReport(run.output);
                }}
                onRetry={handleRetryAnalysis}
                busy={loading}
              />
            </Card>
          </div>

          <Card className="flex min-h-[520px] flex-col">
            <div className="flex-1 overflow-y-auto pr-1 pb-4">
              <ChatThread
                messages={messages}
                selectedReport={selectedRunReport}
                onCloseReport={() => setSelectedRunReport('')}
              />
            </div>
            <MessageComposer
              onSend={handleSend}
              disabled={!selectedConversationId}
              busy={loading}
            />
          </Card>
        </div>
      )}
    </>
  );
}

export default AIMentor;