import { readFileSync } from 'node:fs';

export const PATTERNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const here = new URL('./', import.meta.url);
const read = f => readFileSync(new URL(f, here), 'utf8').trim();

// E は言語仕様を毎回読み込む前提なので、仕様も Skill 本文に含めて数える。
export function skillText(p) {
  return p === 'E' ? read('patterns/E-spec.md') + '\n\n' + read('patterns/E.md') : read(`patterns/${p}.md`);
}

export function promptText(p) {
  return `Apply the skill below to the input below.\n\n<skill>\n${skillText(p)}\n</skill>\n\n<input>\n${read('input.txt')}\n</input>\n`;
}
