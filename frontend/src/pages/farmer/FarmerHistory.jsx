import { Link } from "react-router-dom";
import AppLayout from "../../components/AppLayout";
import { useApp } from "../../context/AppContext";
import { Clock, Folder, MessageSquare, Trash2 } from "lucide-react";

export default function FarmerHistory() {
  const { conversations, folders, deleteConversation } = useApp();

  return (
    <AppLayout title="History">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Chat History</h2>
            <p className="text-xs text-gray-400 mt-1">Your saved crop diagnosis conversations.</p>
          </div>
        </div>

        {conversations.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Clock size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium text-gray-600 mb-1">No saved chats yet</p>
            <p className="text-xs text-gray-400 mb-6">Start a diagnosis using words, a crop photo, or both.</p>
            <Link to="/" className="btn-primary inline-flex items-center gap-2 text-sm">
              <MessageSquare size={15} /> Start your first chat
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conversation) => {
              const folder = folders.find((item) => item.id === conversation.folderId);
              return (
                <div key={conversation.id} className="card flex items-center gap-3 hover:shadow-md transition-shadow">
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0"><MessageSquare size={15} className="text-primary" /></div>
                  <Link to={`/chat/${conversation.id}`} className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700 truncate">{conversation.title}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                      {folder && <span className="inline-flex items-center gap-1"><Folder size={11} /> {folder.name}</span>}
                      <span>{new Date(conversation.updatedAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                  </Link>
                  <button onClick={() => deleteConversation(conversation.id)} className="p-2 text-gray-400 hover:text-red-500" title="Delete chat"><Trash2 size={15} /></button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
