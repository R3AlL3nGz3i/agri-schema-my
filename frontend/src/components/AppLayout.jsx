import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart2, BookOpen, ClipboardCheck, Folder, FolderPlus,
  ChevronDown, ChevronRight, GripVertical, History, LayoutDashboard, Leaf, Lock, LogIn, LogOut, Menu,
  MessageCircle, MessageSquare, MoreHorizontal, Pencil, Plus, Search, Store, Trash2, User, X,
} from "lucide-react";
import { useApp } from "../context/AppContext";

const FARMER_NAV = [
  { to: "/", icon: MessageSquare, label: "AI Diagnosis" },
  { to: "/marketplace", icon: Store, label: "Marketplace", requiresAuth: true },
  { to: "/community", icon: MessageCircle, label: "Community", requiresAuth: true },
  { to: "/farmer/history", icon: History, label: "Chat History", requiresAuth: true },
];

const ADMIN_NAV = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/admin/search", icon: Search, label: "Evidence Search" },
  { to: "/admin/queue", icon: ClipboardCheck, label: "Review Queue" },
  { to: "/admin/knowledge", icon: BookOpen, label: "Knowledge Base" },
  { to: "/admin/analytics", icon: BarChart2, label: "Query Analytics" },
];

const NO_FOLDER_DROP = "no-folder";

export default function AppLayout({ children, title = "AgriScheme" }) {
  const {
    user, logout, isAdmin, hasResearchAccess, isGuest, conversations, folders,
    createConversation, renameConversation, moveConversation, deleteConversation,
    createFolder, renameFolder, deleteFolder,
  } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [addingFolder, setAddingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [chatMenuId, setChatMenuId] = useState(null);
  const [collapsedFolderIds, setCollapsedFolderIds] = useState([]);
  const [draggedChatId, setDraggedChatId] = useState(null);
  const [dragTarget, setDragTarget] = useState(null);
  const isAdminPage = pathname.startsWith("/admin");

  const close = () => setOpen(false);
  const handleLogout = () => { logout(); navigate("/"); };
  const handleNewChat = (folderId = null) => {
    const conversation = createConversation("New chat", { folderId: folderId || null });
    close();
    navigate(`/chat/${conversation.id}`);
  };
  const toggleFolder = (folderId) => {
    setCollapsedFolderIds((current) => current.includes(folderId)
      ? current.filter((id) => id !== folderId)
      : [...current, folderId]);
  };
  const handleFolderSubmit = (event) => {
    event.preventDefault();
    const folder = createFolder(folderName);
    if (folder) {
      setFolderName("");
      setAddingFolder(false);
    }
  };
  const handleRenameFolder = (folder) => {
    const name = window.prompt("Rename folder", folder.name);
    if (name !== null) renameFolder(folder.id, name);
  };
  const handleDeleteFolder = (folder) => {
    const folderChats = conversations.filter((chat) => chat.folderId === folder.id);
    const warning = folderChats.length > 0
      ? `Delete “${folder.name}” and all ${folderChats.length} chat${folderChats.length === 1 ? "" : "s"} inside it? This cannot be undone.`
      : `Delete the empty “${folder.name}” folder?`;
    if (!window.confirm(warning)) return;
    const activeChatDeleted = folderChats.some((chat) => pathname === `/chat/${chat.id}`);
    deleteFolder(folder.id);
    setCollapsedFolderIds((current) => current.filter((id) => id !== folder.id));
    if (activeChatDeleted) navigate("/");
  };
  const handleDragStart = (event, chatId) => {
    setDraggedChatId(chatId);
    setChatMenuId(null);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", chatId);
  };
  const handleDragEnd = () => {
    setDraggedChatId(null);
    setDragTarget(null);
  };
  const handleDrop = (event, folderId = null) => {
    event.preventDefault();
    const chatId = draggedChatId || event.dataTransfer.getData("text/plain");
    if (chatId) moveConversation(chatId, folderId || "");
    handleDragEnd();
  };
  const handleRenameChat = (chat) => {
    const title = window.prompt("Rename this chat", chat.title);
    if (title !== null) renameConversation(chat.id, title);
    setChatMenuId(null);
  };
  const handleDeleteChat = (chat) => {
    if (!window.confirm(`Delete “${chat.title}”?`)) return;
    deleteConversation(chat.id);
    setChatMenuId(null);
    if (pathname === `/chat/${chat.id}`) navigate("/");
  };

  const folderGroups = folders.map((folder) => ({
    ...folder,
    chats: conversations.filter((chat) => chat.folderId === folder.id),
  }));
  const chatsWithoutFolder = conversations.filter((chat) => !chat.folderId);

  const ChatRow = ({ chat, inset = false }) => {
    const active = pathname === `/chat/${chat.id}`;
    const menuOpen = chatMenuId === chat.id;
    return (
      <div draggable={Boolean(user)} onDragStart={(event) => handleDragStart(event, chat.id)} onDragEnd={handleDragEnd}
        className={`relative flex items-center rounded-lg transition-colors ${user ? "cursor-grab active:cursor-grabbing" : ""} ${draggedChatId === chat.id ? "opacity-45" : ""} ${active ? "bg-gray-700 text-white" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
        {user && <GripVertical size={13} className={`${inset ? "ml-2" : "ml-1"} text-slate-600 shrink-0`} aria-hidden="true" />}
        <Link to={`/chat/${chat.id}`} onClick={() => { setChatMenuId(null); close(); }}
          className={`flex items-center gap-2 min-w-0 flex-1 py-2 ${inset ? "pl-2" : "pl-1"}`}>
          <MessageSquare size={12} className="shrink-0" />
          <span className="truncate text-xs">{chat.title}</span>
        </Link>
        <button onClick={() => setChatMenuId(menuOpen ? null : chat.id)}
          className="p-2 mr-1 text-gray-500 hover:text-white rounded-md" title="Chat options" aria-label={`Options for ${chat.title}`}>
          <MoreHorizontal size={15} />
        </button>
        {menuOpen && (
          <div className="absolute right-1 bottom-full mb-1 z-30 w-44 rounded-lg border border-gray-200 bg-white p-1.5 shadow-xl text-gray-700">
            <button onClick={() => handleRenameChat(chat)}
              className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 text-xs hover:bg-gray-100">
              <Pencil size={13} /> Rename chat
            </button>
            {user && (
              <label className="block border-t border-gray-100 mt-1 pt-2 px-2.5 pb-1">
                <span className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-1"><Folder size={11} /> Move to folder</span>
                <select value={chat.folderId || ""}
                  onChange={(event) => { moveConversation(chat.id, event.target.value); setChatMenuId(null); }}
                  className="w-full border rounded-md px-2 py-1.5 text-xs bg-white outline-none focus:border-primary">
                  <option value="">No folder</option>
                  {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
                </select>
              </label>
            )}
            <button onClick={() => handleDeleteChat(chat)}
              className="flex items-center gap-2 w-full rounded-md px-2.5 py-2 mt-1 text-xs text-red-600 hover:bg-red-50 border-t border-gray-100">
              <Trash2 size={13} /> Delete chat
            </button>
          </div>
        )}
      </div>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full w-72 bg-slate-950 text-white">
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-700 shrink-0">
        <Link to="/" onClick={close} className="flex items-center gap-2">
          <Leaf size={20} className="text-accent" />
          <span className="font-bold text-base">AgriScheme</span>
        </Link>
        <button onClick={close} className="md:hidden text-gray-400 hover:text-white" aria-label="Close navigation">
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {!isAdminPage && (
          <button onClick={() => handleNewChat()}
            className="flex items-center gap-2 w-full bg-primary hover:bg-primary-dark text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-3">
            <Plus size={15} /> New chat
          </button>
        )}

        {hasResearchAccess && (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-wider px-3 pb-2 pt-1">{isAdmin ? "Super Admin Portal" : "Research Portal"}</p>
            {ADMIN_NAV.map(({ to, icon: Icon, label }) => (
              <Link key={to} to={to} onClick={close}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${pathname === to ? "bg-gray-700 text-white font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
                <Icon size={15} /> {label}
              </Link>
            ))}
            <div className="border-t border-gray-700 my-3" />
          </>
        )}

        <p className="text-xs text-gray-500 uppercase tracking-wider px-3 pb-2">
          {hasResearchAccess ? "Farmer Portal" : "Farmer Assistant"}
        </p>
        {FARMER_NAV.map(({ to, icon: Icon, label, requiresAuth }) => {
          const active = to === "/" ? pathname === "/" || pathname.startsWith("/chat/") : pathname === to;
          return (
            <Link key={to} to={to} onClick={close}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${active ? "bg-gray-700 text-white font-medium" : "text-gray-400 hover:bg-gray-800 hover:text-white"}`}>
              <Icon size={15} />
              <span className="flex-1">{label}</span>
              {isGuest && requiresAuth && <Lock size={12} className="text-gray-600" />}
            </Link>
          );
        })}

        {isAdminPage && (
          <button onClick={() => handleNewChat()}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-gray-800 hover:text-white transition-colors">
            <Plus size={15} /> New chat
          </button>
        )}

        <div className="border-t border-gray-700 my-3" />
        {user ? (
          <>
            <div className="flex items-center justify-between px-3 pb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Folders</p>
              <button onClick={() => setAddingFolder((value) => !value)} className="text-gray-500 hover:text-white" title="New folder">
                <FolderPlus size={14} />
              </button>
            </div>
            {addingFolder && (
              <form onSubmit={handleFolderSubmit} className="flex gap-1.5 px-2 pb-2">
                <input value={folderName} onChange={(event) => setFolderName(event.target.value)} autoFocus
                  placeholder="Folder name" className="min-w-0 flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs outline-none focus:border-primary" />
                <button className="bg-primary rounded px-2 text-xs" type="submit">Add</button>
              </form>
            )}
            {folderGroups.length === 0 && <p className="px-3 py-2 text-xs text-slate-600">No folders yet.</p>}
            {folderGroups.map((group) => {
              const collapsed = collapsedFolderIds.includes(group.id);
              return (
                <div key={group.id}
                  onDragOver={(event) => { if (user) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragTarget(group.id); } }}
                  onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(null); }}
                  onDrop={(event) => handleDrop(event, group.id)}
                  className={`mb-2 rounded-xl border p-1.5 shadow-sm transition-colors ${dragTarget === group.id ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400" : "border-slate-700/70 bg-slate-900/80"}`}>
                  <div className="flex items-center gap-1 rounded-lg px-1 py-1 text-slate-200">
                    <button onClick={() => toggleFolder(group.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 px-1.5 py-1.5 rounded-md hover:bg-slate-800 text-left"
                      aria-expanded={!collapsed}>
                      {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                      <Folder size={15} className="text-emerald-400 shrink-0" />
                      <span className="flex-1 truncate text-sm font-medium">{group.name}</span>
                      <span className="text-[10px] text-slate-500">{group.chats.length}</span>
                    </button>
                    <button onClick={() => handleNewChat(group.id)}
                      className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-emerald-600"
                      title={`New chat in ${group.name}`} aria-label={`New chat in ${group.name}`}>
                      <Plus size={15} />
                    </button>
                    <button onClick={() => handleRenameFolder(group)} className="p-1.5 text-slate-500 hover:text-white" title="Rename folder"><Pencil size={12} /></button>
                    <button onClick={() => handleDeleteFolder(group)} className="p-1.5 text-slate-500 hover:text-red-400" title="Delete folder"><Trash2 size={12} /></button>
                  </div>
                  {!collapsed && (
                    <div className="pt-1 space-y-0.5">
                      {group.chats.length > 0 ? (
                        group.chats.map((chat) => <ChatRow key={chat.id} chat={chat} inset />)
                      ) : (
                        <button onClick={() => handleNewChat(group.id)}
                          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 py-3 text-xs text-slate-500 hover:border-emerald-500 hover:text-emerald-300 hover:bg-emerald-500/5">
                          <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center"><Plus size={14} /></span>
                          Start a chat in this folder
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            <div onDragOver={(event) => { if (user) { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragTarget(NO_FOLDER_DROP); } }}
              onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setDragTarget(null); }}
              onDrop={(event) => handleDrop(event)}
              className={`border-t mt-3 pt-3 rounded-lg transition-colors ${dragTarget === NO_FOLDER_DROP ? "border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400" : "border-slate-800"}`}>
              <p className="text-xs text-slate-500 uppercase tracking-wider px-3 pb-2">Chats without folder</p>
              {chatsWithoutFolder.length > 0 ? (
                chatsWithoutFolder.map((chat) => <ChatRow key={chat.id} chat={chat} />)
              ) : (
                <p className="px-3 py-2 text-xs text-slate-600">Use New chat to start without a folder.</p>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 uppercase tracking-wider px-3 pb-2">Session chats</p>
            {conversations.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-600">No chats yet.</p>
            ) : (
              conversations.map((chat) => <ChatRow key={chat.id} chat={chat} />)
            )}
            <p className="px-3 pt-3 pb-1 text-[11px] text-gray-600 leading-relaxed">
              Guest chats last for this session. Sign in to save them and use folders.
            </p>
          </>
        )}
      </nav>

      <div className="border-t border-gray-700 p-3 shrink-0">
        {user ? (
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center shrink-0"><User size={13} /></div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 capitalize">{user.role === "user" ? "Farmer" : user.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} title="Sign out" className="text-gray-400 hover:text-white p-1.5 rounded hover:bg-gray-700">
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <Link to="/login" onClick={close} className="flex items-center gap-2 text-gray-400 hover:text-white text-sm">
            <LogIn size={14} /> Sign in
          </Link>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <aside className="hidden md:flex shrink-0"><SidebarContent /></aside>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <SidebarContent />
          <button className="flex-1 bg-black/50" onClick={close} aria-label="Close navigation overlay" />
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <button onClick={() => setOpen(true)} className="text-gray-300 hover:text-white" aria-label="Open navigation"><Menu size={22} /></button>
          <div className="flex items-center gap-2"><Leaf size={17} className="text-accent" /><span className="font-bold text-sm">{title}</span></div>
          {isGuest ? (
            <Link to="/login" className="text-xs font-medium bg-primary px-3 py-1.5 rounded-lg">Sign in</Link>
          ) : !isAdminPage ? (
            <button onClick={() => handleNewChat()} className="text-gray-300 hover:text-white" aria-label="New chat"><Plus size={22} /></button>
          ) : <div className="w-6" />}
        </header>

        {!isAdminPage && (
          <header className="hidden md:flex bg-white border-b px-6 py-2.5 items-center justify-between shrink-0">
            <nav className="flex items-center gap-1">
              {FARMER_NAV.map(({ to, icon: Icon, label, requiresAuth }) => {
                const active = to === "/" ? pathname === "/" || pathname.startsWith("/chat/") : pathname === to;
                return (
                  <Link key={to} to={to}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${active ? "bg-[var(--surface-sunk)] text-[var(--brand-dark)] font-semibold" : "text-[var(--ink-soft)] hover:bg-[var(--surface-sunk)] hover:text-[var(--ink)]"}`}>
                    <Icon size={15} />
                    <span>{label}</span>
                    {isGuest && requiresAuth && <Lock size={12} className="text-[var(--ink-faint)]" />}
                  </Link>
                );
              })}
            </nav>
            {isGuest ? (
              <Link to="/login" className="btn-primary inline-flex items-center gap-2 text-sm py-2"><LogIn size={14} /> Sign in</Link>
            ) : (
              <div className="flex items-center gap-2 text-sm text-[var(--ink-soft)]"><User size={14} /> {user?.name}</div>
            )}
          </header>
        )}

        {isAdminPage && (
          <header className="hidden md:flex bg-white border-b px-6 py-3 items-center justify-between shrink-0">
            <h1 className="text-sm font-medium text-gray-500">{isAdmin ? "Super Admin Portal" : "Researcher Portal"}</h1>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">{user?.name}</span>
          </header>
        )}

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
