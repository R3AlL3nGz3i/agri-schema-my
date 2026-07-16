import { createContext, useContext, useEffect, useState } from "react";

const AppContext = createContext();

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const accountKey = (kind, user) => user?.email ? `agri_${kind}_${user.email.toLowerCase()}` : null;

function readStored(key, fallback) {
  if (!key) return fallback;
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function serializableConversations(conversations) {
  return conversations.map((conversation) => ({
    ...conversation,
    messages: conversation.messages.map(({ image, ...message }) => ({
      ...message,
      hadImage: Boolean(image || message.hadImage),
    })),
  }));
}

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agri_user")) || null; }
    catch { return null; }
  });
  const [chatHistory, setChatHistory] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [folders, setFolders] = useState([]);

  useEffect(() => {
    setConversations(readStored(accountKey("conversations", user), []));
    setFolders(readStored(accountKey("chat_folders", user), []));
    setChatHistory(readStored(accountKey("history", user), []));
  }, [user]);

  const persistConversations = (updated) => {
    if (user) localStorage.setItem(accountKey("conversations", user), JSON.stringify(serializableConversations(updated)));
  };

  const persistFolders = (updated) => {
    if (user) localStorage.setItem(accountKey("chat_folders", user), JSON.stringify(updated));
  };

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("agri_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    setConversations([]);
    setFolders([]);
    setChatHistory([]);
    localStorage.removeItem("agri_user");
  };

  const createConversation = (title = "New chat", options = {}) => {
    const conversation = {
      id: makeId("chat"),
      title,
      folderId: null,
      cropContext: null,
      pendingQuery: null,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...options,
    };
    setConversations((current) => {
      const updated = [conversation, ...current];
      persistConversations(updated);
      return updated;
    });
    return conversation;
  };

  const appendConversationMessages = (conversationId, messages) => {
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, messages: [...conversation.messages, ...messages], updatedAt: Date.now() }
        : conversation);
      persistConversations(updated);
      return updated;
    });
  };

  const renameConversation = (conversationId, title) => {
    const cleanTitle = title.trim().slice(0, 80) || "Untitled chat";
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId ? { ...conversation, title: cleanTitle } : conversation);
      persistConversations(updated);
      return updated;
    });
  };

  const moveConversation = (conversationId, folderId) => {
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId ? { ...conversation, folderId: folderId || null } : conversation);
      persistConversations(updated);
      return updated;
    });
  };

  const updateConversationCrop = (conversationId, cropContext) => {
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, cropContext, updatedAt: Date.now() }
        : conversation);
      persistConversations(updated);
      return updated;
    });
  };

  const setConversationPendingQuery = (conversationId, pendingQuery) => {
    setConversations((current) => {
      const updated = current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, pendingQuery }
        : conversation);
      persistConversations(updated);
      return updated;
    });
  };

  const deleteConversation = (conversationId) => {
    setConversations((current) => {
      const updated = current.filter((conversation) => conversation.id !== conversationId);
      persistConversations(updated);
      return updated;
    });
  };

  const createFolder = (name) => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return null;
    const folder = { id: makeId("folder"), name: cleanName, createdAt: Date.now() };
    setFolders((current) => {
      const updated = [...current, folder];
      persistFolders(updated);
      return updated;
    });
    return folder;
  };

  const renameFolder = (folderId, name) => {
    const cleanName = name.trim().slice(0, 40);
    if (!cleanName) return;
    setFolders((current) => {
      const updated = current.map((folder) => folder.id === folderId ? { ...folder, name: cleanName } : folder);
      persistFolders(updated);
      return updated;
    });
  };

  const deleteFolder = (folderId) => {
    setFolders((current) => {
      const updated = current.filter((folder) => folder.id !== folderId);
      persistFolders(updated);
      return updated;
    });
    setConversations((current) => {
      const updated = current.filter((conversation) => conversation.folderId !== folderId);
      persistConversations(updated);
      return updated;
    });
  };

  const addHistory = (entry) => {
    if (!user) return;
    setChatHistory((current) => {
      const updated = [entry, ...current].slice(0, 100);
      localStorage.setItem(accountKey("history", user), JSON.stringify(updated));
      return updated;
    });
  };

  const clearHistory = () => {
    setChatHistory([]);
    if (user) localStorage.removeItem(accountKey("history", user));
  };

  const isAdmin = user?.role === "admin";
  const isResearcher = user?.role === "researcher";
  const hasResearchAccess = isAdmin || isResearcher;
  const isUser = user?.role === "user";
  const isGuest = !user;

  return (
    <AppContext.Provider value={{
      user, login, logout, isAdmin, isResearcher, hasResearchAccess, isUser, isGuest,
      chatHistory, addHistory, clearHistory,
      conversations, folders, createConversation, appendConversationMessages,
      renameConversation, moveConversation, updateConversationCrop,
      setConversationPendingQuery, deleteConversation,
      createFolder, renameFolder, deleteFolder,
    }}>
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => useContext(AppContext);
