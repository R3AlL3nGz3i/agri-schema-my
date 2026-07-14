import { createContext, useContext, useState } from "react";

const AppContext = createContext();

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem("agri_user")) || null; }
    catch { return null; }
  });

  // Chat history — persisted for logged-in users, session-only for guests
  const [chatHistory, setChatHistory] = useState(() => {
    try {
      const stored = localStorage.getItem("agri_history");
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem("agri_user", JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("agri_user");
    localStorage.removeItem("agri_history");
    setChatHistory([]);
  };

  const addHistory = (entry) => {
    const updated = [entry, ...chatHistory].slice(0, 20);
    setChatHistory(updated);
    // Only persist for logged-in users
    if (user) localStorage.setItem("agri_history", JSON.stringify(updated));
  };

  const clearHistory = () => {
    setChatHistory([]);
    localStorage.removeItem("agri_history");
  };

  const isAdmin = user?.role === "admin";
  const isUser  = user?.role === "user";
  const isGuest = !user;

  return (
    <AppContext.Provider value={{
      user, login, logout,
      isAdmin, isUser, isGuest,
      chatHistory, addHistory, clearHistory,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);
