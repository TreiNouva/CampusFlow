import { PageHeader } from '@/components/layout/page-header';
import { ProjectCalendar } from '@/components/calendar/project-calendar';
import { ProjectTimeline } from '@/components/dashboard/project-timeline';
import { buildItems } from '@/components/calendar/calendar-utils';
import { createClient } from '@/lib/supabase/server';
import { getProjectContext } from '@/lib/project-context';
import { buildParticipants } from '@/lib/event-participants';
import { todayJakarta } from '@/lib/dates';

export default async function ProjectCalendarPage({ params }: { params: { projectId: string } }) {
  const { project, myRole, myDivisionId, userId } = await getProjectContext(params.projectId);
  const supabase = createClient();
  const today = todayJakarta();
  const pid = project.id;

  const [{ data: tasks }, { data: divisions }, { data: events }, { data: milestones }, { data: members }, { data: attendance }] = await Promise.all([
    supabase.from('tasks').select('id, title, status, due_date, start_date, division_id').eq('project_id', pid),
    supabase.from('project_divisions').select('id, name, color').eq('project_id', pid).order('created_at'),
    supabase.from('project_events').select('*').eq('project_id', pid)
      .gte('start_at', new Date(Date.now() - 180 * 86400_000).toISOString())
      .lte('start_at', new Date(Date.now() + 365 * 86400_000).toISOString())
      .order('start_at'),
    supabase.from('project_milestones').select('*').eq('project_id', pid).order('due_date'),
    supabase.from('project_members').select('user_id, role, division_id, profile:profiles(full_name)').eq('project_id', pid),
    supabase.from('event_attendance').select('event_id, user_id, status, checked_in_at'),
  ]);

  const divList = (divisions ?? []) as { id: string; name: string; color: string }[];
  const eventList = (events ?? []) as any[];
  const items = buildItems({ projectId: pid, tasks: (tasks ?? []) as any[], events: eventList, milestones: (milestones ?? []) as any[], divisions: divList });
  const participants = buildParticipants(eventList, (members ?? []) as any[], (attendance ?? []) as any[]);

  return (
    <main className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader title="Kalender" description="Task, acara, dan milestone project. Hari di luar periode project diberi arsir dan tidak bisa dipakai untuk jadwal." />
      <ProjectTimeline start={project.start_date} end={project.end_date} today={today} milestones={(milestones ?? []) as any[]} />
      <ProjectCalendar
        projectId={pid}
        today={today}
        period={{ start: project.start_date, end: project.end_date }}
        items={items}
        divisions={divList}
        events={eventList}
        participants={participants}
        myRole={myRole}
        myDivisionId={myDivisionId}
        myUserId={userId}
      />
    </main>
  );
}
