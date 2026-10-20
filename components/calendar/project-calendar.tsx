'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  AttendancePanel, DeleteMilestoneButton, EventDialog, MilestoneDialog,
  type EventRecord, type Participant,
} from './calendar-dialogs';
import { itemsOnDay, layoutTimed, packAllDayLanes, type CalItem } from './calendar-utils';
import {
  addDays, addMonths, DAY_NAMES_SHORT, minutesOfDay, monthMatrix, monthTitle, parseDay, shortDate, startOfMonth, startOfWeek,
} from '@/lib/dates';
import { MILESTONE_COLOR, divisionColor, GLOBAL_COLOR } from '@/lib/colors';
import { canManageAnyScope, canManageScoped } from '@/lib/roles';
import { cn } from '@/lib/utils';
import type { ProjectRole } from '@/types/database';

const HOUR_PX = 44;
const GUTTER = 44;

interface Division { id: string; name: string; color: string }

interface Props {
  projectId: string;
  today: string;
  items: CalItem[];
  divisions: Division[];
  events: EventRecord[];
  participants: Record<string, Participant[]>;
  myRole: ProjectRole;
  myDivisionId: string | null;
  myUserId: string;
}

const filterKey = (i: CalItem) => (i.kind === 'milestone' ? 'milestone' : i.divisionId ?? 'global');

export function ProjectCalendar({ projectId, today, items, divisions, events, participants, myRole, myDivisionId, myUserId }: Props) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [cursor, setCursor] = useState(today);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<CalItem | null>(null);
  const [dialog, setDialog] = useState<null | { type: 'event'; event?: EventRecord } | { type: 'milestone' }>(null);
  const [now, setNow] = useState<Date | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (view === 'week' && scrollRef.current) scrollRef.current.scrollTop = HOUR_PX * 7;
  }, [view]);

  const visible = useMemo(() => items.filter((i) => !hidden.has(filterKey(i))), [items, hidden]);
  const weekStart = startOfWeek(cursor);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const { bars, laneCount } = useMemo(() => packAllDayLanes(visible, weekStart), [visible, weekStart]);

  const canEvent = canManageAnyScope(myRole, myDivisionId);
  const canMilestone = myRole === 'project_manager' || myRole === 'wakil_project_manager';

  function step(dir: -1 | 1) {
    setCursor((c) => (view === 'week' ? addDays(c, dir * 7) : addMonths(c, dir)));
  }
  function toggle(key: string) {
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const title = view === 'month' ? monthTitle(cursor) : `${shortDate(weekStart)} – ${shortDate(addDays(weekStart, 6))} ${parseDay(addDays(weekStart, 6)).getUTCFullYear()}`;
  const nowMin = now ? minutesOfDay(now.toISOString()) : 0;

  const selectedEvent = selected?.kind === 'event' ? events.find((e) => e.id === selected.id) : undefined;
  const legend: { key: string; label: string; color: string }[] = [
    { key: 'global', label: 'Global / umum', color: GLOBAL_COLOR.accent },
    ...divisions.map((d) => ({ key: d.id, label: d.name, color: divisionColor(d.color).accent })),
    { key: 'milestone', label: 'Milestone', color: MILESTONE_COLOR.accent },
  ];

  return (
    <div className="rounded-card border border-gray-100 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-bold text-ink">{title}</h2>
          <div className="ml-2 flex items-center gap-1">
            <button type="button" onClick={() => step(-1)} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100" aria-label="Sebelumnya">‹</button>
            <button type="button" onClick={() => setCursor(today)} className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-gray-50">Hari ini</button>
            <button type="button" onClick={() => step(1)} className="rounded-md px-2 py-1 text-sm hover:bg-gray-100" aria-label="Berikutnya">›</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-xs font-semibold">
            {(['week', 'month'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)}
                className={cn('rounded-md px-3 py-1 transition-colors', view === v ? 'bg-white text-navy shadow-sm' : 'text-muted')}>
                {v === 'week' ? 'Minggu' : 'Bulan'}
              </button>
            ))}
          </div>
          {canEvent && <Button size="sm" onClick={() => setDialog({ type: 'event' })}>+ Acara</Button>}
          {canMilestone && <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'milestone' })}>+ Milestone</Button>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr]">
        {/* Sidebar: mini kalender + legenda */}
        <aside className="space-y-4 border-b border-gray-100 p-4 lg:border-b-0 lg:border-r">
          <MiniMonth cursor={cursor} today={today} weekStart={weekStart} onPick={(d) => setCursor(d)} items={items} />
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">Kalender</p>
            <ul className="space-y-1">
              {legend.map((l) => (
                <li key={l.key}>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-ink">
                    <input type="checkbox" checked={!hidden.has(l.key)} onChange={() => toggle(l.key)}
                      className="h-3.5 w-3.5 rounded" style={{ accentColor: l.color }} />
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: l.color }} />
                    <span className="truncate">{l.label}</span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] leading-snug text-muted">
              Task tampil sebagai bilah per hari sesuai warna divisinya. Garis tebal = acara/jadwal.
            </p>
          </div>
        </aside>

        {/* Area utama */}
        <div className="min-w-0">
          {view === 'week' ? (
            <div>
              {/* Header hari */}
              <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}>
                <div />
                {weekDays.map((d, i) => {
                  const isToday = d === today;
                  return (
                    <div key={d} className="py-2 text-center">
                      <p className="text-[11px] font-semibold uppercase text-muted">{DAY_NAMES_SHORT[i]}</p>
                      <p className={cn('mx-auto mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold', isToday ? 'bg-orange text-white' : 'text-ink')}>
                        {parseDay(d).getUTCDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Jalur sepanjang hari */}
              <div className="grid border-b border-gray-100" style={{ gridTemplateColumns: `${GUTTER}px 1fr` }}>
                <div className="pr-1 pt-1 text-right text-[10px] leading-tight text-muted">sehari<br />penuh</div>
                <div className="relative" style={{ height: Math.max(laneCount, 1) * 22 + 8 }}>
                  <div className="pointer-events-none absolute inset-0 grid grid-cols-7">
                    {weekDays.map((d) => <div key={d} className={cn('border-l border-gray-100', d === today && 'bg-orange/5')} />)}
                  </div>
                  {bars.map((b) => (
                    <button key={b.item.id + b.item.startDay} type="button" onClick={() => setSelected(b.item)}
                      title={b.item.title}
                      className={cn('absolute truncate px-1.5 text-left text-[11px] font-semibold leading-[18px] transition-all hover:brightness-95',
                        b.clippedStart ? 'rounded-l-none' : 'rounded-l-md', b.clippedEnd ? 'rounded-r-none' : 'rounded-r-md',
                        selected?.id === b.item.id && 'ring-2 ring-navy', b.item.done && 'opacity-60 line-through')}
                      style={{
                        left: `calc(${(b.col / 7) * 100}% + 2px)`, width: `calc(${(b.span / 7) * 100}% - 4px)`, top: 4 + b.lane * 22, height: 20,
                        backgroundColor: b.item.color.bg, color: b.item.color.text, borderLeft: `3px solid ${b.item.color.accent}`,
                      }}>
                      {b.item.kind === 'milestone' ? '◆ ' : b.item.kind === 'task' ? '☐ ' : ''}{b.item.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid jam */}
              <div ref={scrollRef} className="relative overflow-y-auto" style={{ height: 440 }}>
                <div className="relative grid" style={{ height: HOUR_PX * 24, gridTemplateColumns: `${GUTTER}px repeat(7, minmax(0, 1fr))` }}>
                  <div className="relative">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[10px] text-muted" style={{ top: h * HOUR_PX }}>
                        {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                      </span>
                    ))}
                  </div>
                  {weekDays.map((d) => {
                    const placed = layoutTimed(visible, d);
                    return (
                      <div key={d} className={cn('relative border-l border-gray-100', d === today && 'bg-orange/5')}>
                        {Array.from({ length: 24 }, (_, h) => (
                          <div key={h} className="absolute inset-x-0 border-t border-gray-100" style={{ top: h * HOUR_PX }} />
                        ))}
                        {placed.map((p) => (
                          <button key={p.item.id} type="button" onClick={() => setSelected(p.item)} title={p.item.title}
                            className={cn('absolute overflow-hidden rounded-md px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm transition-all hover:brightness-95 hover:z-10',
                              selected?.id === p.item.id && 'ring-2 ring-navy')}
                            style={{
                              top: p.top * HOUR_PX * 24, height: p.height * HOUR_PX * 24 - 1,
                              left: `calc(${p.left * 100}% + 1px)`, width: `calc(${p.width * 100}% - 3px)`,
                              backgroundColor: p.item.color.bg, color: p.item.color.text, borderLeft: `3px solid ${p.item.color.accent}`,
                            }}>
                            <span className="font-semibold">{p.item.title}</span>
                            <span className="block opacity-80">{hhmm(p.item.startMin)}–{hhmm(p.item.endMin)}</span>
                          </button>
                        ))}
                        {d === today && now && (
                          <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: (nowMin / 1440) * HOUR_PX * 24 }}>
                            <span className="-ml-1 h-2 w-2 rounded-full bg-red-500" />
                            <span className="h-px flex-1 bg-red-500" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <MonthGrid cursor={cursor} today={today} items={visible} onSelect={setSelected} onDayClick={(d) => { setCursor(d); setView('week'); }} selectedId={selected?.id} />
          )}

          {/* Panel detail */}
          {selected && (
            <div className="border-t border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: selected.color.bg, color: selected.color.text }}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: selected.color.accent }} />
                    {selected.kind === 'task' ? 'Task' : selected.kind === 'milestone' ? 'Milestone' : 'Acara'} · {selected.subtitle ?? 'Global'}
                  </span>
                  <h3 className="mt-1 font-heading text-base font-bold text-ink">{selected.title}</h3>
                  <p className="text-xs text-muted">
                    {selected.startDay === selected.endDay ? shortDate(selected.startDay) : `${shortDate(selected.startDay)} – ${shortDate(selected.endDay)}`}
                    {selected.kind === 'event' && !selected.allDay && ` · ${hhmm(selected.startMin)}–${hhmm(selected.endMin)} WIB`}
                  </p>
                  {selectedEvent?.description && <p className="mt-1 whitespace-pre-line text-sm text-ink">{selectedEvent.description}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                  {selected.href && <Link href={selected.href} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-navy hover:bg-gray-50">Buka task →</Link>}
                  {selectedEvent && canManageScoped(myRole, myDivisionId, selectedEvent.division_id) && (
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ type: 'event', event: selectedEvent })}>Edit</Button>
                  )}
                  {selected.kind === 'milestone' && canMilestone && (
                    <DeleteMilestoneButton projectId={projectId} milestoneId={selected.id} onDone={() => setSelected(null)} />
                  )}
                  <button type="button" onClick={() => setSelected(null)} className="rounded-md px-2 text-sm text-muted hover:bg-gray-100" aria-label="Tutup detail">✕</button>
                </div>
              </div>
              {selectedEvent && participants[selectedEvent.id] && (
                <AttendancePanel
                  projectId={projectId}
                  eventId={selectedEvent.id}
                  participants={participants[selectedEvent.id]}
                  canManage={canManageScoped(myRole, myDivisionId, selectedEvent.division_id)}
                  canCheckIn={myRole !== 'ketua'}
                  myUserId={myUserId}
                  startAt={selectedEvent.start_at}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {dialog?.type === 'event' && (
        <EventDialog projectId={projectId} divisions={divisions} myRole={myRole} myDivisionId={myDivisionId}
          initialDay={cursor} event={dialog.event} onClose={() => { setDialog(null); setSelected(null); }} />
      )}
      {dialog?.type === 'milestone' && <MilestoneDialog projectId={projectId} initialDay={cursor} onClose={() => setDialog(null)} />}
    </div>
  );
}

function hhmm(min: number) {
  const m = Math.min(min, 1439);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function MiniMonth({ cursor, today, weekStart, onPick, items }: { cursor: string; today: string; weekStart: string; onPick: (d: string) => void; items: CalItem[] }) {
  const [month, setMonth] = useState(startOfMonth(cursor));
  useEffect(() => setMonth(startOfMonth(cursor)), [cursor]);
  const rows = monthMatrix(month);
  const weekEnd = addDays(weekStart, 6);
  const busy = useMemo(() => {
    const s = new Set<string>();
    for (const i of items) for (let d = i.startDay, n = 0; d <= i.endDay && n < 60; d = addDays(d, 1), n++) s.add(d);
    return s;
  }, [items]);
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold text-ink">{monthTitle(month)}</span>
        <span className="flex">
          <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="rounded px-1.5 text-sm hover:bg-gray-100" aria-label="Bulan sebelumnya">‹</button>
          <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="rounded px-1.5 text-sm hover:bg-gray-100" aria-label="Bulan berikutnya">›</button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[10px] text-muted">
        {DAY_NAMES_SHORT.map((n) => <span key={n}>{n[0]}</span>)}
      </div>
      <div className="grid grid-cols-7 text-center text-[11px]">
        {rows.flat().map((d) => {
          const inMonth = d.slice(0, 7) === month.slice(0, 7);
          const inWeek = d >= weekStart && d <= weekEnd;
          return (
            <button key={d} type="button" onClick={() => onPick(d)}
              className={cn('relative my-px h-6 transition-colors', inWeek && 'bg-sky/60', d === weekStart && 'rounded-l-md', d === weekEnd && 'rounded-r-md',
                !inMonth && 'text-gray-300', d === today ? 'font-bold text-white' : 'hover:bg-gray-100')}>
              {d === today && <span className="absolute inset-0 m-auto h-6 w-6 rounded-full bg-orange" />}
              <span className="relative">{parseDay(d).getUTCDate()}</span>
              {busy.has(d) && d !== today && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-teal" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MonthGrid({ cursor, today, items, onSelect, onDayClick, selectedId }: {
  cursor: string; today: string; items: CalItem[]; onSelect: (i: CalItem) => void; onDayClick: (d: string) => void; selectedId?: string;
}) {
  const rows = monthMatrix(cursor);
  return (
    <div>
      <div className="grid grid-cols-7 border-b border-gray-100 text-center text-[11px] font-semibold uppercase text-muted">
        {DAY_NAMES_SHORT.map((n) => <div key={n} className="py-2">{n}</div>)}
      </div>
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7">
          {row.map((d) => {
            const inMonth = d.slice(0, 7) === cursor.slice(0, 7);
            const list = itemsOnDay(items, d);
            return (
              <div key={d} className={cn('min-h-[92px] border-b border-l border-gray-100 p-1', !inMonth && 'bg-gray-50/70')}>
                <button type="button" onClick={() => onDayClick(d)}
                  className={cn('flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold hover:bg-gray-100', d === today ? 'bg-orange text-white hover:bg-orange' : inMonth ? 'text-ink' : 'text-gray-300')}>
                  {parseDay(d).getUTCDate()}
                </button>
                <div className="mt-0.5 space-y-0.5">
                  {list.slice(0, 3).map((i) => (
                    <button key={i.id} type="button" onClick={() => onSelect(i)} title={i.title}
                      className={cn('block w-full truncate rounded px-1 text-left text-[10px] font-semibold leading-4 hover:brightness-95', selectedId === i.id && 'ring-1 ring-navy', i.done && 'line-through opacity-60')}
                      style={{ backgroundColor: i.color.bg, color: i.color.text, borderLeft: `2px solid ${i.color.accent}` }}>
                      {i.title}
                    </button>
                  ))}
                  {list.length > 3 && <button type="button" onClick={() => onDayClick(d)} className="px-1 text-[10px] font-semibold text-muted hover:text-ink">+{list.length - 3} lagi</button>}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

