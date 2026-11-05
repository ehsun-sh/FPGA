// How long a lesson takes: reading time of the prose plus a fixed practice budget, so a learner can plan a sitting.
type L = 'fa' | 'en';

const faNum = (n: number, lang: L) => (lang === 'fa' ? n.toLocaleString('fa-IR', { useGrouping: false }) : String(n));

// words of prose in lesson HTML; code blocks and tags do not count
export function wordCount(html: string): number {
  return html
    .replace(/<pre[\s\S]*?<\/pre>|<[^>]+>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
}

// read: about 180 words a minute, at least 2; practice: 5 for "try it", 10 for an exercise, 5 more from chapter 4 on
// (1-based chapter number), where the designs get bigger
export function lessonTime(
  l: { body: string; tryIt: string; exercise?: string; time?: { read: number; practice: number } },
  hasExercise: boolean,
  chapter: number,
): { read: number; practice: number } {
  if (l.time) return { ...l.time };
  const read = Math.max(2, Math.round(wordCount(`${l.body} ${l.tryIt} ${l.exercise ?? ''}`) / 180));
  const practice = 5 + (hasExercise ? 10 : 0) + (chapter >= 4 ? 5 : 0);
  return { read, practice };
}

// "≈ 1 h 10 min" / «≈ ۱ ساعت و ۱۰ دقیقه»
export function formatMinutes(min: number, lang: L): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const n = (x: number) => faNum(x, lang);
  if (lang === 'fa') {
    const parts = [h ? `${n(h)} ساعت` : '', m || !h ? `${n(m)} دقیقه` : ''].filter(Boolean);
    return `≈ ${parts.join(' و ')}`;
  }
  const parts = [h ? `${h} h` : '', m || !h ? `${m} min` : ''].filter(Boolean);
  return `≈ ${parts.join(' ')}`;
}
