// Lightweight renderer for the constrained markdown the grounded answer layer
// returns: `### headings`, `**bold**`, `*`/`-` bullet lists, `[n]` citations.
// No dangerouslySetInnerHTML — everything is real React nodes, so it's XSS-safe.

function renderInline(text) {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\n]+\*|\[\d+\])/g)
    .filter(Boolean)
    .map((tok, i) => {
      if (/^\*\*[^*]+\*\*$/.test(tok))
        return <strong key={i} className="font-semibold text-gray-800">{tok.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(tok))
        return <em key={i} className="italic">{tok.slice(1, -1)}</em>;
      if (/^\[\d+\]$/.test(tok))
        return <sup key={i} className="text-primary/70 font-medium ml-0.5">{tok}</sup>;
      return <span key={i}>{tok}</span>;
    });
}

export default function AnswerText({ text, className = "" }) {
  const lines = (text || "").split("\n");
  const blocks = [];
  let list = null;

  const flush = () => {
    if (list) { blocks.push({ type: "ul", items: list }); list = null; }
  };

  lines.forEach((raw) => {
    const line = raw.trimEnd();
    if (/^#{1,4}\s+/.test(line)) {
      flush();
      blocks.push({ type: "h", text: line.replace(/^#{1,4}\s+/, "") });
    } else if (/^\s*[*-]\s+/.test(line)) {
      (list ||= []).push(line.replace(/^\s*[*-]\s+/, ""));
    } else if (line.trim() === "") {
      flush();
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  });
  flush();

  return (
    <div className={`space-y-3 text-sm text-gray-700 leading-relaxed ${className}`}>
      {blocks.map((b, i) => {
        if (b.type === "h")
          return <h4 key={i} className="text-sm font-bold text-gray-800 mt-1">{renderInline(b.text)}</h4>;
        if (b.type === "ul")
          return (
            <ul key={i} className="space-y-1.5">
              {b.items.map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-primary mt-1.5 h-1 w-1 rounded-full bg-primary shrink-0" />
                  <span>{renderInline(it)}</span>
                </li>
              ))}
            </ul>
          );
        return <p key={i}>{renderInline(b.text)}</p>;
      })}
    </div>
  );
}
