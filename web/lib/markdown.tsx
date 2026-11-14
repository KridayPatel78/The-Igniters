import type { ReactNode } from "react";

// Minimal markdown for rubric.md (headings, paragraphs, nested lists, tables, code blocks, bold,
// inline code, links). Written here to avoid a markdown dependency; the input is our own file.

function inline(text: string, key = 0): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${m.index}`;
    if (m[1] !== undefined) out.push(<strong key={k}>{inline(m[1], m.index)}</strong>);
    else if (m[2] !== undefined) out.push(<code key={k} className="rounded bg-panel-2 px-1 py-0.5 font-mono text-[0.85em]">{m[2]}</code>);
    else if (m[3] !== undefined) out.push(<a key={k} href={m[4]} className="text-ion underline underline-offset-4">{m[3]}</a>);
    else out.push(<em key={k}>{m[5]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface ListItem {
  text: string;
  children: ListItem[];
}

function renderList(items: ListItem[], key: string, ordered = false): ReactNode {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag key={key} className={`${ordered ? "list-decimal" : "list-disc"} space-y-1 pl-5`}>
      {items.map((it, i) => (
        <li key={i}>
          {inline(it.text)}
          {it.children.length ? renderList(it.children, `${key}-${i}`) : null}
        </li>
      ))}
    </Tag>
  );
}

export function Markdown({ source, idPrefix = "md" }: { source: string; idPrefix?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(
        <pre key={i} className="overflow-x-auto rounded-lg border border-line bg-panel-2 p-3 text-xs">
          <code className="font-mono">{code.join("\n")}</code>
        </pre>,
      );
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2];
      const id = `${idPrefix}-${text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
      const cls = ["", "text-2xl", "text-xl", "text-lg", "text-base"][level];
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      out.push(<Tag key={i} id={id} className={`${cls} mt-6 scroll-mt-24 font-semibold tracking-tight`}>{inline(text)}</Tag>);
      i++;
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-+:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        <div key={i} className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-left">
              <tr>{head.map((c, j) => <th key={j} scope="col" className="px-3 py-2 font-medium text-muted">{inline(c)}</th>)}</tr>
            </thead>
            <tbody>
              {body.map((r, j) => (
                <tr key={j} className="border-t border-line">
                  {r.map((c, k) => <td key={k} className="px-3 py-2">{inline(c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const bullet = /^(\s*)([-*]|\d+\.)\s+(.*)$/;
    if (bullet.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const root: ListItem[] = [];
      const stack: { indent: number; items: ListItem[] }[] = [{ indent: 0, items: root }];
      while (i < lines.length && (bullet.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const m = bullet.exec(lines[i]);
        if (!m) {
          // continuation line of the previous item
          const items = stack[stack.length - 1].items;
          items[items.length - 1].text += ` ${lines[i].trim()}`;
          i++;
          continue;
        }
        const indent = m[1].length;
        while (stack.length > 1 && indent < stack[stack.length - 1].indent) stack.pop();
        const top = stack[stack.length - 1];
        if (indent > top.indent && top.items.length) {
          const parent = top.items[top.items.length - 1];
          stack.push({ indent, items: parent.children });
        }
        stack[stack.length - 1].items.push({ text: m[3], children: [] });
        i++;
      }
      out.push(renderList(root, `l${i}`, ordered));
      continue;
    }
    const para: string[] = [lines[i++].trim()];
    while (i < lines.length && lines[i].trim() && !/^(#|```|\s*[-*]\s|\s*\d+\.\s|\s*\|)/.test(lines[i])) para.push(lines[i++].trim());
    out.push(<p key={i} className="leading-relaxed">{inline(para.join(" "))}</p>);
  }
  return <div className="space-y-3">{out}</div>;
}
