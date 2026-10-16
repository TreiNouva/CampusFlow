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

export const addOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid(),
  email: z.string().email('Email tidak valid'),
  role: z.enum(['admin', 'coordinator', 'member', 'viewer']),
});

export const createProjectSchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(3, 'Nama project minimal 3 karakter').max(150),
  description: z.string().max(1000).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const addProjectMemberSchema = z.object({
  projectId: z.string().uuid(),
  email: z.string().email('Email tidak valid'),
  role: z.enum(['coordinator', 'member', 'viewer']),
});

export const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3, 'Judul task minimal 3 karakter').max(200),
  description: z.string().max(2000).optional(),
  assigneeId: z.string().uuid().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  dueDate: z.string().optional().nullable(),
});

export const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().min(3).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'done', 'blocked']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  dueDate: z.string().optional().nullable(),
});

export const notificationPreferenceSchema = z.object({
  projectId: z.string().uuid(),
  level: z.enum(['all', 'important', 'off']),
});

export const projectAnnouncementSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(3).max(150),
  body: z.string().min(1).max(2000),
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
