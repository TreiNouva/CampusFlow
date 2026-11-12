import { z } from 'zod';

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export const loginSchema = z.object({
  email: z.string().email('Email tidak valid'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(3, 'Nama organisasi minimal 3 karakter').max(120),
  description: z.string().max(500).optional(),
});

const orgRoleEnum = z.enum(['wakil_ketua', 'koordinator', 'sekretaris', 'bendahara', 'member']);
const projectRoleEnum = z.enum([
  'project_manager',
  'wakil_project_manager',
  'pic',
  'koordinator',
  'bendahara',
  'sekretaris',
  'member',
]);

export const addOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email('Email tidak valid'),
  role: orgRoleEnum,
});

export const changeOrgMemberRoleSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
  role: orgRoleEnum,
});

export const orgMemberTargetSchema = z.object({
  organizationId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(3, 'Nama project minimal 3 karakter').max(150),
  description: z.string().max(1000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  projectManagerId: z.string().uuid().optional(),
});

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email('Email tidak valid'),
  role: projectRoleEnum,
  divisionId: z.string().uuid().optional(),
});

export const changeProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
  role: projectRoleEnum,
  divisionId: z.string().uuid().optional(),
});

export const projectMemberTargetSchema = z.object({
  projectId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const divisionSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nama divisi minimal 2 karakter').max(60, 'Nama divisi maksimal 60 karakter'),
  color: z.string().max(20).optional(),
});

export const divisionColorSchema = z.object({
  projectId: z.string().uuid(),
  divisionId: z.string().uuid(),
  color: z.string().min(2).max(20),
});

export const deleteDivisionSchema = z.object({
  projectId: z.string().uuid(),
  divisionId: z.string().uuid(),
});

export const createInviteSchema = z.object({
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  divisionId: z.string().uuid().optional(),
  expiresDays: z.coerce.number().int().min(1).max(30).default(7),
  maxUses: z.coerce.number().int().min(1).optional(),
});

export const announcementSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(3, 'Judul minimal 3 karakter').max(150, 'Judul maksimal 150 karakter'),
  body: z.string().trim().min(1, 'Isi pengumuman wajib diisi').max(4000, 'Isi pengumuman maksimal 4000 karakter'),
  divisionId: z.string().uuid().optional().nullable(),
});

export const updateAnnouncementSchema = announcementSchema.extend({
  announcementId: z.string().uuid(),
  resend: z.boolean().default(false),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3, 'Judul task minimal 3 karakter').max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  divisionId: z.string().uuid().optional().nullable(),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional().nullable(),
  startDate: z.string().optional().nullable(),
  divisionId: z.string().uuid().optional().nullable(),
});

export const notificationPreferenceSchema = z.object({
  projectId: z.string().uuid(),
  level: z.enum(['all', 'important', 'off']),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password minimal 8 karakter'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Konfirmasi password tidak sama',
    path: ['confirmPassword'],
  });

const dayString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid');

export const eventSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2, 'Judul minimal 2 karakter').max(150),
  description: z.string().trim().max(2000).optional().nullable(),
  location: z.string().trim().max(150).optional().nullable(),
  divisionId: z.string().uuid().optional().nullable(),
  startDate: dayString,
  endDate: dayString,
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable(),
  allDay: z.boolean().default(false),
});
export const updateEventSchema = eventSchema.extend({ eventId: z.string().uuid() });

export const milestoneSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(2, 'Judul minimal 2 karakter').max(120),
  dueDate: dayString,
});

export const attendanceSchema = z.object({
  projectId: z.string().uuid(),
  eventId: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['present', 'excused', 'absent']),
});

const amount = z.coerce.number().int('Nominal harus bilangan bulat').min(0).max(100_000_000_000);
export const budgetPlanSchema = z.object({
  projectId: z.string().uuid(),
  divisionId: z.string().uuid().optional().nullable(),
  category: z.string().trim().min(2, 'Kategori minimal 2 karakter').max(60),
  plannedAmount: amount,
});
export const budgetEntrySchema = z.object({
  projectId: z.string().uuid(),
  divisionId: z.string().uuid().optional().nullable(),
  entryType: z.enum(['income', 'expense']),
  category: z.string().trim().min(2, 'Kategori minimal 2 karakter').max(60),
  amount: amount.refine((n) => n > 0, 'Nominal harus lebih dari 0'),
  note: z.string().trim().max(300).optional().nullable(),
  entryDate: dayString,
});
export const documentCategorySchema = z.enum(['proposal', 'lpj', 'rundown', 'notulen', 'desain', 'surat', 'lainnya']);
