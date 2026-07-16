import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Camera, HelpCircle, ImagePlus, Leaf, Loader, Send, Sprout, Users, X,
} from "lucide-react";
import AppLayout from "../../components/AppLayout";
import { ConfidenceBar } from "../../components/Badges";
import { useApp } from "../../context/AppContext";
import { queryDisease } from "../../api";

const CROPS = ["paddy", "durian", "banana", "chilli", "tomato", "rubber", "oil_palm", "cocoa"];
const CROP_ALIASES = [
  { crop: "oil_palm", terms: ["oil palm", "palm oil"] },
  { crop: "paddy", terms: ["paddy", "rice"] },
  { crop: "durian", terms: ["durian"] },
  { crop: "banana", terms: ["banana", "plantain"] },
  { crop: "chilli", terms: ["chilli", "chili", "pepper"] },
  { crop: "tomato", terms: ["tomato"] },
  { crop: "rubber", terms: ["rubber"] },
  { crop: "cocoa", terms: ["cocoa", "cacao"] },
];
const QUICK_PROMPTS = [
  "My paddy leaves have brown diamond-shaped spots",
  "How can I identify chilli anthracnose?",
  "My banana plant is yellowing and wilting",
];

const messageId = () => `message-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const cropLabel = (crop) => crop?.replace("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

function detectCrop(text) {
  const normalized = text.toLowerCase();
  return CROP_ALIASES.find(({ terms }) => terms.some((term) => new RegExp(`\\b${term}\\b`, "i").test(normalized)))?.crop || "";
}

function needsCropClarification(text, hasImage) {
  if (hasImage) return true;
  const normalized = text.toLowerCase();
  const symptomWords = /\b(yellow|brown|spot|spots|wilt|wilting|dying|rot|rotting|holes|curl|curling|lesion|lesions)\b/;
  return symptomWords.test(normalized) && normalized.split(/\s+/).filter(Boolean).length < 12;
}

function VerdictBadge({ verdict }) {
  const value = (verdict || "pending").toUpperCase();
  const styles = {
    PASS: "bg-green-100 text-green-700",
    FLAG: "bg-amber-100 text-amber-700",
    REJECT: "bg-red-100 text-red-700",
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${styles[value] || "bg-gray-100 text-gray-600"}`}>
      Evidence review: {value}
    </span>
  );
}

function ResultCards({ results }) {
  return (
    <div className="space-y-3 w-full">
      <p className="text-xs text-gray-400">Possible matches from the crop knowledge base</p>
      {results.map((result, index) => (
        <article key={`${result.disease_name}-${index}`} className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">{result.disease_name}</h3>
              <p className="text-xs text-gray-400 capitalize">
                {result.local_name && `${result.local_name} · `}{result.crop?.replace("_", " ")}
              </p>
            </div>
            <VerdictBadge verdict={result.professor_verdict} />
          </div>
          <p className="text-xs leading-relaxed text-gray-600 mb-3">{result.symptoms_summary}</p>
          <ConfidenceBar value={result.relevance_score} />
          {result.treatments?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Knowledge-base treatments</p>
              <p className="text-xs text-gray-600">{result.treatments.slice(0, 3).join(", ")}</p>
            </div>
          )}
        </article>
      ))}
      <p className="text-[11px] text-gray-400">
        These are evidence matches, not a confirmed diagnosis. Consult a local agriculture professional before treatment.
      </p>
    </div>
  );
}

export default function ChatAssistant() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const {
    user, conversations, createConversation, appendConversationMessages,
    renameConversation, updateConversationCrop, setConversationPendingQuery, addHistory,
  } = useApp();
  const conversation = useMemo(
    () => conversations.find((item) => item.id === chatId) || null,
    [chatId, conversations],
  );
  const [input, setInput] = useState("");
  const [crop, setCrop] = useState("");
  const [cropUnknown, setCropUnknown] = useState(false);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation?.messages, loading]);

  useEffect(() => {
    setCrop(conversation?.cropContext?.value || "");
    setCropUnknown(conversation?.cropContext?.status === "identifying");
  }, [conversation?.id, conversation?.cropContext?.status, conversation?.cropContext?.value]);

  const startConversation = () => {
    const created = createConversation();
    navigate(`/chat/${created.id}`);
    return created;
  };

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setImage({ dataUrl: reader.result, name: file.name });
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const runQuery = async (conversationId, selectedCrop, text, hadImage) => {
    setLoading(true);
    try {
      const response = await queryDisease({
        crop: selectedCrop || undefined,
        symptom: text || (hadImage ? "visible crop disease symptoms" : undefined),
        n_results: 5,
      });
      const cropNote = selectedCrop
        ? `[${cropLabel(selectedCrop)}] — `
        : "[All crops] — ";
      const note = hadImage
        ? `${cropNote}I included your photo in this conversation. This prototype currently matches the confirmed crop and written details against the knowledge base; direct image recognition still needs a backend vision endpoint.`
        : `${cropNote}I’ll keep this context for your follow-up questions.`;
      const assistantMessage = {
        id: messageId(),
        role: "assistant",
        content: response.data.length ? note : `${cropNote}I could not find a close match. Try adding the crop name and describing colour, shape, location, and how quickly the symptom spread.`,
        results: response.data,
        createdAt: Date.now(),
      };
      appendConversationMessages(conversationId, [assistantMessage]);
      addHistory({ label: text || `${cropLabel(selectedCrop)} photo diagnosis`, conversationId, ts: Date.now() });
    } catch {
      appendConversationMessages(conversationId, [{
        id: messageId(),
        role: "assistant",
        content: `${selectedCrop ? `[${cropLabel(selectedCrop)}] — ` : ""}I could not reach the crop knowledge service. Please make sure the backend is running and try again.`,
        createdAt: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const beginCropIdentification = (conversationId, details = "", hadImage = false, previousContext = null) => {
    const notes = [...(previousContext?.notes || [])];
    if (details && !notes.includes(details)) notes.push(details);
    updateConversationCrop(conversationId, {
      value: null,
      status: "identifying",
      source: "photo",
      confirmed: false,
      notes,
      photoCount: (previousContext?.photoCount || 0) + (hadImage ? 1 : 0),
    });
    setConversationPendingQuery(conversationId, null);
    setCrop("");
    setCropUnknown(true);
    appendConversationMessages(conversationId, [{
      id: messageId(),
      role: "assistant",
      content: previousContext?.status === "identifying"
        ? "[Crop unknown] — I’ve added that information to this identification case. If possible, add a clear whole-plant photo and a close-up of a leaf, fruit, flower, or stem."
        : "[Crop unknown] — No problem. We’ll identify the crop before diagnosing it. The current prototype cannot recognize a plant from the photo automatically, so I won’t guess. Add a whole-plant photo, a close-up, or describe its size, leaves, fruit, flowers, and where it is growing.",
      clarification: "crop-identification",
      createdAt: Date.now(),
    }]);
  };

  const sendMessage = async (suggestedText) => {
    const text = (suggestedText ?? input).trim();
    if (loading || (!text && !crop && !image)) return;

    const activeConversation = conversation || startConversation();
    const imageSnapshot = image;
    const detectedCrop = detectCrop(text);
    const rememberedCrop = activeConversation.cropContext?.value || crop;
    const identifyingCrop = cropUnknown || activeConversation.cropContext?.status === "identifying";
    const label = text || (identifyingCrop ? "Photo for crop identification" : `${cropLabel(rememberedCrop) || "Crop"} photo diagnosis`);
    const userMessage = {
      id: messageId(),
      role: "user",
      content: label,
      image: imageSnapshot?.dataUrl,
      imageName: imageSnapshot?.name,
      hadImage: Boolean(imageSnapshot),
      createdAt: Date.now(),
    };

    appendConversationMessages(activeConversation.id, [userMessage]);
    if (activeConversation.messages.length === 0) renameConversation(activeConversation.id, label);
    setInput("");
    setImage(null);

    if (identifyingCrop && !detectedCrop) {
      beginCropIdentification(
        activeConversation.id,
        text,
        Boolean(imageSnapshot),
        activeConversation.cropContext,
      );
      return;
    }

    const pendingQuery = { text, hadImage: Boolean(imageSnapshot), detectedCrop };
    if (detectedCrop && rememberedCrop && detectedCrop !== rememberedCrop) {
      setConversationPendingQuery(activeConversation.id, pendingQuery);
      appendConversationMessages(activeConversation.id, [{
        id: messageId(),
        role: "assistant",
        content: `[${cropLabel(rememberedCrop)} → ${cropLabel(detectedCrop)}] — You mentioned a different crop. Which crop should I use for this conversation?`,
        clarification: "crop-switch",
        detectedCrop,
        rememberedCrop,
        createdAt: Date.now(),
      }]);
      return;
    }

    const selectedCrop = detectedCrop || rememberedCrop;
    if (!selectedCrop && needsCropClarification(text, Boolean(imageSnapshot))) {
      setConversationPendingQuery(activeConversation.id, pendingQuery);
      appendConversationMessages(activeConversation.id, [{
        id: messageId(),
        role: "assistant",
        content: imageSnapshot
          ? "[Crop needed] — You attached a crop photo. Which crop is it? Add a written symptom too, because direct image recognition is not connected yet."
          : "[Crop needed] — Those symptoms can affect several crops. Which crop are you diagnosing?",
        clarification: "crop",
        createdAt: Date.now(),
      }]);
      return;
    }

    if (selectedCrop) {
      const source = detectedCrop ? "detected" : activeConversation.cropContext?.source || "selected";
      updateConversationCrop(activeConversation.id, { value: selectedCrop, source, confirmed: true });
      setCrop(selectedCrop);
    }
    setConversationPendingQuery(activeConversation.id, null);
    await runQuery(activeConversation.id, selectedCrop, text, Boolean(imageSnapshot));
  };

  const chooseCrop = async (selectedCrop) => {
    const wasIdentifying = conversation?.cropContext?.status === "identifying";
    setCrop(selectedCrop);
    setCropUnknown(false);
    if (!conversation) return;
    updateConversationCrop(conversation.id, {
      value: selectedCrop,
      status: "confirmed",
      source: "selected",
      confirmed: true,
    });
    const pending = conversation.pendingQuery;
    if (pending) {
      setConversationPendingQuery(conversation.id, null);
      if (pending.hadImage && !pending.text) {
        appendConversationMessages(conversation.id, [{
          id: messageId(),
          role: "assistant",
          content: `[${cropLabel(selectedCrop)}] — Thanks. Now describe what you see in the photo, such as spots, yellowing, wilting, or rot.`,
          createdAt: Date.now(),
        }]);
        return;
      }
      await runQuery(conversation.id, selectedCrop, pending.text, pending.hadImage);
    } else if (wasIdentifying) {
      appendConversationMessages(conversation.id, [{
        id: messageId(),
        role: "assistant",
        content: `[${cropLabel(selectedCrop)}] — The crop has been confirmed. Tell me what looks unhealthy or what you would like to know about it.`,
        createdAt: Date.now(),
      }]);
    }
  };

  const handleUnknownCrop = () => {
    setCrop("");
    setCropUnknown(true);
    if (!conversation) return;
    if (conversation.cropContext?.status === "identifying") return;
    beginCropIdentification(
      conversation.id,
      conversation.pendingQuery?.text || "",
      conversation.pendingQuery?.hadImage || false,
      conversation.cropContext,
    );
  };

  const keepRememberedCrop = async () => {
    const pending = conversation?.pendingQuery;
    const rememberedCrop = conversation?.cropContext?.value;
    if (!pending || !rememberedCrop) return;
    setConversationPendingQuery(conversation.id, null);
    await runQuery(conversation.id, rememberedCrop, pending.text, pending.hadImage);
  };

  const clearCrop = () => {
    setCrop("");
    setCropUnknown(false);
    if (conversation) updateConversationCrop(conversation.id, null);
  };

  const messages = conversation?.messages || [];

  return (
    <AppLayout title="Crop AI Assistant">
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.length === 0 && (
              <div className="min-h-[55vh] flex flex-col justify-center items-center text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-sm">
                  <Leaf size={23} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-800 mb-2">How can I help your crop?</h1>
                <p className="text-sm text-gray-500 max-w-lg mb-7">
                  Describe a symptom, choose a crop, attach a photo, or use all three for better evidence matches.
                </p>
                <div className="grid sm:grid-cols-3 gap-2 w-full max-w-2xl">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt} onClick={() => sendMessage(prompt)}
                      className="text-left bg-white border border-gray-200 hover:border-primary rounded-xl p-3 text-xs text-gray-600 transition-colors">
                      {prompt}
                    </button>
                  ))}
                </div>
                {!user && (
                  <p className="mt-5 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    Guest chats last for this session. Sign in to save chats and organize them into folders.
                  </p>
                )}
              </div>
            )}

            {messages.map((message) => (
              <div key={message.id} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <Sprout size={15} className="text-white" />
                  </div>
                )}
                <div className={`max-w-[88%] sm:max-w-[78%] space-y-2 ${message.role === "user" ? "text-right" : "text-left"}`}>
                  {message.image && <img src={message.image} alt={message.imageName || "Uploaded crop"} className="max-h-64 ml-auto rounded-xl border object-cover" />}
                  {message.hadImage && !message.image && (
                    <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2"><Camera size={13} /> Photo attached in original session</div>
                  )}
                  {message.content && (
                    <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-white rounded-tr-sm" : "bg-white border border-gray-200 text-gray-700 rounded-tl-sm"}`}>
                      {message.content}
                    </div>
                  )}
                  {message.clarification && message.id === messages[messages.length - 1]?.id
                    && (conversation?.pendingQuery || message.clarification === "crop-identification") && (
                    <div className="bg-white border border-gray-200 rounded-xl p-3 text-left">
                      {message.clarification === "crop-switch" && (
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => chooseCrop(message.detectedCrop)} className="btn-primary text-xs py-1.5">
                            Switch to {cropLabel(message.detectedCrop)}
                          </button>
                          <button onClick={keepRememberedCrop} className="btn-outline text-xs py-1.5">
                            Keep {cropLabel(message.rememberedCrop)}
                          </button>
                        </div>
                      )}
                      {message.clarification === "crop" && (
                        <>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {CROPS.map((item) => (
                              <button key={item} onClick={() => chooseCrop(item)}
                                className="border border-gray-200 hover:border-primary hover:text-primary rounded-lg px-2 py-2 text-xs capitalize transition-colors">
                                {cropLabel(item)}
                              </button>
                            ))}
                          </div>
                          <button onClick={handleUnknownCrop}
                            className="mt-2 w-full inline-flex items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-700 rounded-lg px-3 py-2 text-xs hover:bg-amber-100">
                            <HelpCircle size={13} /> I don’t know the crop
                          </button>
                        </>
                      )}
                      {message.clarification === "crop-identification" && (
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-medium text-gray-600 mb-2">Recognize it now? Confirm the crop:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {CROPS.map((item) => (
                                <button key={item} onClick={() => chooseCrop(item)}
                                  className="border border-gray-200 hover:border-primary hover:text-primary rounded-lg px-2 py-2 text-xs transition-colors">
                                  {cropLabel(item)}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                            <button onClick={() => fileRef.current?.click()}
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                              <ImagePlus size={13} /> Add another photo
                            </button>
                            <button onClick={() => navigate("/community")}
                              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                              <Users size={13} /> Ask the community
                            </button>
                          </div>
                          <p className="text-[11px] text-gray-400">You can also type details about its size, leaves, fruit, flowers, and where it grows.</p>
                        </div>
                      )}
                    </div>
                  )}
                  {message.results?.length > 0 && <ResultCards results={message.results} />}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 items-center text-sm text-gray-500">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"><Sprout size={15} className="text-white" /></div>
                <Loader size={15} className="animate-spin" /> Searching the knowledge base…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="bg-white border-t px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto">
            {image && (
              <div className="mb-2">
                <div className="inline-flex items-center gap-2 bg-gray-100 rounded-lg p-1.5 pr-2">
                  <img src={image.dataUrl} alt="Crop preview" className="w-10 h-10 object-cover rounded-md" />
                  <span className="text-xs text-gray-600 max-w-40 truncate">{image.name}</span>
                  <button onClick={() => setImage(null)} className="text-gray-400 hover:text-red-500"><X size={14} /></button>
                </div>
                {!crop && !cropUnknown && (
                  <p className="text-[11px] text-amber-600 mt-1">Select the crop below, or choose “I don’t know,” before sending this photo.</p>
                )}
              </div>
            )}
            <div className="border border-gray-300 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 rounded-2xl p-2 bg-white shadow-sm">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Ask about a crop disease or describe what you see…"
                rows={2}
                className="w-full resize-none outline-none px-2 py-1 text-sm"
              />
              <div className="flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-primary" title="Attach crop photo">
                  <ImagePlus size={18} />
                </button>
                {cropUnknown ? (
                  <div className="inline-flex items-center gap-1.5 text-xs bg-amber-50 text-amber-700 border border-amber-200 rounded-full pl-2.5 pr-1.5 py-1.5">
                    <HelpCircle size={13} />
                    <span>Crop unknown</span>
                    <span className="text-[10px]">identifying</span>
                    <button onClick={clearCrop} className="p-0.5 rounded-full hover:bg-amber-100" title="Clear crop identification"><X size={12} /></button>
                  </div>
                ) : crop ? (
                  <div className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-primary border border-green-100 rounded-full pl-2.5 pr-1.5 py-1.5">
                    <Sprout size={13} />
                    <span>{cropLabel(crop)}</span>
                    {conversation?.cropContext?.source === "detected" && <span className="text-[10px] text-green-600">detected</span>}
                    <button onClick={clearCrop} className="p-0.5 rounded-full hover:bg-green-100" title="Clear crop"><X size={12} /></button>
                  </div>
                ) : (
                  <select value="" onChange={(event) => event.target.value === "unknown" ? handleUnknownCrop() : chooseCrop(event.target.value)}
                    className="text-xs border rounded-lg px-2 py-2 bg-gray-50 outline-none focus:border-primary capitalize">
                    <option value="">{image ? "Select crop or choose unknown" : "Select crop (optional)"}</option>
                    {CROPS.map((item) => <option key={item} value={item}>{cropLabel(item)}</option>)}
                    <option value="unknown">I don’t know the crop</option>
                  </select>
                )}
                <span className="flex-1" />
                <button onClick={() => sendMessage()}
                  disabled={loading || (!input.trim() && !crop && !image) || (image && !crop && !cropUnknown)}
                  className="bg-primary hover:bg-primary-dark text-white p-2.5 rounded-xl disabled:opacity-40 transition-colors" title="Send message">
                  {loading ? <Loader size={17} className="animate-spin" /> : <Send size={17} />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-1.5">Photo recognition requires a future vision backend; add written symptoms for the current prototype.</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
