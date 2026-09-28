/** Paragraphs and lists in a model's plain-text answer; headings become plain lines. */

export type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

const LIST_ITEM = /^(?:([-*•])|(\d{1,2})[.)])\s+(.*)$/;

export function toBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length > 0) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/^#{1,6}\s+/, "");
    if (!line) {
      flush();
      continue;
    }
    const item = LIST_ITEM.exec(line);
    if (item) {
      flush();
      const kind = item[2] ? "ol" : "ul";
      const last = blocks[blocks.length - 1];
      if (last && last.kind === kind) last.items.push(item[3]!);
      else blocks.push({ kind, items: [item[3]!] });
      continue;
    }
    para.push(line);
  }
  flush();
  return blocks;
}
