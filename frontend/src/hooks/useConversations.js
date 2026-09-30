import { conversationsApi } from '../lib/api/conversations';
import { useAsync } from './useAsync';

export function useConversations(projectId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
    setError,
  } = useAsync(() => (projectId ? conversationsApi.list(projectId) : Promise.resolve([])), {
    auto: Boolean(projectId),
    deps: [projectId],
  });

  const conversations = data ?? [];

  const create = async (payload) => {
    const conversation = await conversationsApi.create(projectId, payload);
    setData((previous) => [conversation, ...(previous || [])]);
    return conversation;
  };

  const rename = async (conversationId, title) => {
    const updated = await conversationsApi.rename(conversationId, { title });
    setData((previous) => (previous || []).map((item) => (item.id === conversationId ? updated : item)));
    return updated;
  };

  const remove = async (conversationId) => {
    await conversationsApi.delete(conversationId);
    setData((previous) => (previous || []).filter((item) => item.id !== conversationId));
  };

  return {
    conversations,
    loading,
    error,
    refetch,
    setConversations: setData,
    setError,
    createConversation: create,
    renameConversation: rename,
    deleteConversation: remove,
  };
}

export function useMessages(conversationId) {
  const {
    data,
    loading,
    error,
    run: refetch,
    setData,
    setError,
    setLoading,
  } = useAsync(
    () => (conversationId ? conversationsApi.messages(conversationId) : Promise.resolve([])),
    { auto: Boolean(conversationId), deps: [conversationId] },
  );

  const messages = data ?? [];

  const send = async (text) => {
    const assistant = await conversationsApi.sendMessage(conversationId, { message: text });
    setData((previous) => [
      ...(previous || []),
      { id: `user-${assistant.id}`, role: 'user', message: text },
      assistant,
    ]);
    return assistant;
  };

  return { messages, loading, error, refetch, setMessages: setData, setError, setLoading, sendMessage: send };
}