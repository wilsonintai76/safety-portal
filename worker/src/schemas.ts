import { z } from 'zod';
import { REGISTERABLE_ROLES, ROLES } from '../../shared/roles';
import { AI_PROVIDERS } from '../../shared/ai';

const shortText = z.string().trim().max(500);
const longText = z.string().trim().max(8000);

export const hirarcRowSchema = z.object({
  id: z.string().max(100).optional(),
  rnr: z.enum(['R', 'NR']),
  workActivity: shortText,
  hazard: longText,
  effect: longText,
  existingControl: longText,
  l: z.coerce.number().int().min(1).max(5),
  s: z.coerce.number().int().min(1).max(5),
  recommendedControl: longText,
  pic: shortText,
  dueDate: z.string().max(30),
  status: z.enum(['Selesai', 'Dalam Tindakan', 'Belum Selesai', 'Kekal / Sedia Ada'])
});

export const hirarcDataSchema = z.object({
  hirNo: z.string().trim().max(100).default(''),
  title: z.string().trim().min(1, 'Tajuk HIRARC diperlukan.').max(300),
  dept: z.string().trim().max(300).default(''),
  location: z.string().trim().min(1, 'Lokasi diperlukan.').max(300),
  preparedBy: z.string().trim().min(1, 'Nama penyedia diperlukan.').max(300),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tarikh mestilah YYYY-MM-DD.'),
  rows: z.array(hirarcRowSchema).min(1, 'Sekurang-kurangnya satu baris hazard diperlukan.').max(200)
});

export const checklistItemSchema = z.object({
  id: z.string().max(100).optional(),
  seksyen: z.string().trim().max(300).default(''),
  item: z.string().trim().min(1).max(1000),
  jawapan: z.enum(['Ya', 'Tidak', 'NA', '']),
  catatan: z.string().trim().max(2000).default('')
});

export const checklistDataSchema = z.object({
  nama: z.string().trim().min(1, 'Nama pemeriksa diperlukan.').max(300),
  lokasi: z.string().trim().min(1, 'Lokasi diperlukan.').max(300),
  tarikh: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tarikh mestilah YYYY-MM-DD.'),
  items: z.array(checklistItemSchema).min(1, 'Sekurang-kurangnya satu item semakan diperlukan.').max(300)
});

export const createDocumentSchema = z
  .object({
    jenis: z.enum(['HIRARC', 'L2B']),
    submit: z.boolean().default(true),
    hirarc: hirarcDataSchema.optional(),
    checklist: checklistDataSchema.optional()
  })
  .superRefine((value, ctx) => {
    if (value.jenis === 'HIRARC' && !value.hirarc) {
      ctx.addIssue({ code: 'custom', message: 'Data HIRARC diperlukan.', path: ['hirarc'] });
    }
    if (value.jenis === 'L2B' && !value.checklist) {
      ctx.addIssue({ code: 'custom', message: 'Data senarai semak diperlukan.', path: ['checklist'] });
    }
  });

export const updateDocumentSchema = z
  .object({
    submit: z.boolean().optional(),
    hirarc: hirarcDataSchema.optional(),
    checklist: checklistDataSchema.optional()
  })
  .refine((value) => value.hirarc || value.checklist || value.submit !== undefined, {
    message: 'Tiada perubahan dihantar.'
  });

export const reviewDocumentSchema = z.object({
  decision: z.enum(['semak', 'lulus', 'tolak']),
  note: z.string().trim().max(2000).default('')
});

export const aiSuggestionSchema = z.object({
  workActivity: z.string().trim().min(1).max(1000),
  hazard: z.string().trim().min(1).max(2000),
  effect: z.string().trim().max(2000).optional().default(''),
  existingControl: z.string().trim().max(2000).optional().default(''),
  likelihood: z.coerce.number().int().min(1).max(5),
  severity: z.coerce.number().int().min(1).max(5),
  riskLevel: z.string().trim().max(20).optional(),
  workshop: z.string().trim().max(300).optional().default('')
});

export const aiSettingsSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  model: z.string().trim().max(200).optional().default(''),
  baseUrl: z.string().trim().max(500).optional().default(''),
  apiKey: z.string().trim().max(500).optional(),
  clearApiKey: z.boolean().optional().default(false)
});

export const updateUserSchema = z
  .object({
    role: z.enum(ROLES).optional(),
    isSystemAdmin: z.boolean().optional(),
    deptId: z.string().trim().max(100).optional(),
    workshopId: z.string().trim().max(100).nullable().optional(),
    status: z.enum(['aktif', 'nyahaktif', 'ditolak', 'menunggu']).optional(),
    registrationNote: z.string().trim().max(500).optional()
  })
  .refine((value) => Object.values(value).some((entry) => entry !== undefined), {
    message: 'Tiada perubahan dihantar.'
  });

export const userQuerySchema = z.object({
  status: z.enum(['menunggu', 'aktif', 'ditolak', 'nyahaktif']).optional(),
  q: z.string().trim().max(200).optional()
});

export const listQuerySchema = z.object({
  jenis: z.enum(['HIRARC', 'L2B']).optional(),
  status: z.enum(['draf', 'dihantar', 'disemak', 'diluluskan', 'ditolak']).optional(),
  q: z.string().trim().max(200).optional(),
  location: z.string().trim().max(300).optional(),
  from: z.string().max(30).optional(),
  to: z.string().max(30).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200)
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(100)
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Nama penuh diperlukan.').max(300)
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Nama penuh diperlukan.').max(300),
    email: z.string().trim().toLowerCase().email('Format e-mel tidak sah.'),
    staffId: z.string().trim().max(60).optional().default(''),
    role: z.enum(REGISTERABLE_ROLES, {
      error: 'Peranan Pentadbir Sistem tidak boleh dimohon melalui pendaftaran.'
    }),
    deptId: z.string().trim().max(100).optional().default('dept-jkm'),
    workshopId: z.string().trim().max(100).nullable().optional(),
    note: z.string().trim().max(500).optional().default(''),
    password: z.string().min(8, 'Kata laluan mestilah sekurang-kurangnya 8 aksara.').max(200),
    confirmPassword: z.string().max(200)
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Pengesahan kata laluan tidak sepadan.',
    path: ['confirmPassword']
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, 'E-mel atau no. pekerja diperlukan.').max(200),
  password: z.string().min(1, 'Kata laluan diperlukan.').max(200)
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(8, 'Kata laluan baharu mestilah sekurang-kurangnya 8 aksara.').max(200)
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, 'Kata laluan baharu mestilah sekurang-kurangnya 8 aksara.').max(200)
});

export const createWorkshopSchema = z.object({
  deptId: z.string().trim().min(1).default('dept-jkm'),
  code: z
    .string()
    .trim()
    .min(1, 'Kod bengkel diperlukan.')
    .max(20, 'Kod bengkel maksimum 20 aksara.')
    .transform((val) => val.toUpperCase()),
  name: z
    .string()
    .trim()
    .min(2, 'Nama bengkel/makmal diperlukan.')
    .max(150, 'Nama bengkel maksimum 150 aksara.')
    .transform((val) => val.toUpperCase()),
  kind: z.enum(['bengkel', 'makmal', 'bilik']).default('bengkel'),
  blockLocation: z.string().trim().max(100).optional().nullable()
});

export type HirarcInput = z.infer<typeof hirarcDataSchema>;
export type ChecklistInput = z.infer<typeof checklistDataSchema>;
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type ReviewDecision = z.infer<typeof reviewDocumentSchema>['decision'];
export type AiSuggestionInput = z.infer<typeof aiSuggestionSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type AiSettingsInput = z.infer<typeof aiSettingsSchema>;
export type ListQuery = z.infer<typeof listQuerySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type UserQuery = z.infer<typeof userQuerySchema>;
