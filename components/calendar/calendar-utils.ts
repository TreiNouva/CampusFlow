import { addDays, dayOfTimestamp, diffDays, minutesOfDay } from '@/lib/dates';
import { divisionColor, EVENT_COLOR, MILESTONE_COLOR, type ColorSpec } from '@/lib/colors';

export type CalKind = 'task' | 'event' | 'milestone';

export interface CalItem {
  id: string;
  kind: CalKind;
  title: string;
  divisionId: string | null; // null = Global / tanpa divisi
  color: ColorSpec;
  startDay: string; // inklusif
  endDay: string; // inklusif
  allDay: boolean; // tampil di jalur "sepanjang hari"
  startMin: number; // hanya bila !allDay
  endMin: number;
  done?: boolean;
  subtitle?: string;
  href?: string;
}

interface TaskIn { id: string; title: string; status: string; start_date: string | null; due_date: string | null; division_id: string | null }
interface EventIn { id: string; title: string; start_at: string; end_at: string; all_day: boolean; division_id: string | null; location?: string | null }
interface MilestoneIn { id: string; title: string; due_date: string }
interface DivisionIn { id: string; name: string; color: string }

export function buildItems(input: {
  projectId: string;
  tasks: TaskIn[];
  events: EventIn[];
  milestones: MilestoneIn[];
  divisions: DivisionIn[];
}): CalItem[] {
  const divMap = new Map(input.divisions.map((d) => [d.id, d]));
  const items: CalItem[] = [];

  for (const t of input.tasks) {
    const s = t.start_date ?? t.due_date;
    const e = t.due_date ?? t.start_date;
    if (!s || !e) continue;
    const [startDay, endDay] = s <= e ? [s, e] : [e, s];
    const d = t.division_id ? divMap.get(t.division_id) : undefined;
    items.push({
      id: t.id, kind: 'task', title: t.title, divisionId: t.division_id,
      color: d ? divisionColor(d.color) : divisionColor(null),
      startDay, endDay, allDay: true, startMin: 0, endMin: 1440, done: t.status === 'done',
      subtitle: d?.name, href: `/projects/${input.projectId}/tasks/${t.id}`,
    });
  }

  for (const ev of input.events) {
    const startDay = dayOfTimestamp(ev.start_at);
    let endDay = dayOfTimestamp(ev.end_at);
    if (endDay < startDay) endDay = startDay;
    const d = ev.division_id ? divMap.get(ev.division_id) : undefined;
    const multiDay = endDay !== startDay;
    items.push({
      id: ev.id, kind: 'event', title: ev.title, divisionId: ev.division_id,
      color: d ? divisionColor(d.color) : EVENT_COLOR,
      startDay, endDay,
      allDay: ev.all_day || multiDay,
      startMin: ev.all_day ? 0 : minutesOfDay(ev.start_at),
      endMin: ev.all_day ? 1440 : multiDay ? 1440 : Math.max(minutesOfDay(ev.end_at), minutesOfDay(ev.start_at) + 15),
      subtitle: ev.location ?? d?.name ?? 'Global',
    });
  }

  for (const m of input.milestones) {
    items.push({
      id: m.id, kind: 'milestone', title: m.title, divisionId: null, color: MILESTONE_COLOR,
      startDay: m.due_date, endDay: m.due_date, allDay: true, startMin: 0, endMin: 1440, subtitle: 'Milestone',
    });
  }
  return items;
}

export function itemsOnDay(items: CalItem[], day: string): CalItem[] {
  return items.filter((i) => i.startDay <= day && day <= i.endDay);
}

export interface Bar { item: CalItem; col: number; span: number; lane: number; clippedStart: boolean; clippedEnd: boolean }

/** Susun item sepanjang-hari ke dalam jalur (lane) untuk 7 hari mulai `weekStart`; item yang tumpang tindih diberi jalur berbeda. */
export function packAllDayLanes(items: CalItem[], weekStart: string, days = 7): { bars: Bar[]; laneCount: number } {
  const weekEnd = addDays(weekStart, days - 1);
  const visible = items
    .filter((i) => i.allDay && i.startDay <= weekEnd && i.endDay >= weekStart)
    .sort((a, b) => a.startDay.localeCompare(b.startDay) || diffDays(b.endDay, b.startDay) - diffDays(a.endDay, a.startDay) || a.title.localeCompare(b.title));
  const laneEnds: number[] = [];
  const bars: Bar[] = [];
  for (const item of visible) {
    const col = Math.max(0, diffDays(item.startDay, weekStart));
    const endCol = Math.min(days - 1, diffDays(item.endDay, weekStart));
    let lane = laneEnds.findIndex((end) => end < col);
    if (lane === -1) { lane = laneEnds.length; laneEnds.push(endCol); } else laneEnds[lane] = endCol;
    bars.push({ item, col, span: endCol - col + 1, lane, clippedStart: item.startDay < weekStart, clippedEnd: item.endDay > weekEnd });
  }
  return { bars, laneCount: laneEnds.length };
}

export interface Placed { item: CalItem; top: number; height: number; left: number; width: number }

/** Tata letak acara berjam di satu hari: acara yang bertabrakan dibagi kolom sama lebar. */
export function layoutTimed(items: CalItem[], day: string, minHeight = 0.02): Placed[] {
  const list = items
    .filter((i) => !i.allDay && i.startDay <= day && day <= i.endDay)
    .sort((a, b) => a.startMin - b.startMin || b.endMin - a.endMin);
  const out: Placed[] = [];
  let cluster: CalItem[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (!cluster.length) return;
    const colEnds: number[] = [];
    const assigned = cluster.map((item) => {
      let c = colEnds.findIndex((e) => e <= item.startMin);
      if (c === -1) { c = colEnds.length; colEnds.push(item.endMin); } else colEnds[c] = item.endMin;
      return { item, c };
    });
    for (const { item, c } of assigned) {
      out.push({
        item, top: item.startMin / 1440,
        height: Math.max((item.endMin - item.startMin) / 1440, minHeight),
        left: c / colEnds.length, width: 1 / colEnds.length,
      });
    }
    cluster = []; clusterEnd = -1;
  };
  for (const item of list) {
    if (cluster.length && item.startMin >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, item.endMin);
  }
  flush();
  return out;
}
