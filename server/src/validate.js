import { z } from "zod";

export const StudentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  grade: z.string().optional().nullable(),
  student_phone: z.string().optional().nullable(),
  parent_phone: z.string().optional().nullable()
});

export const RuleSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  points: z.number().int(),
  is_active: z.number().int().optional(),
  sort_order: z.number().int().optional()
});

export const PenaltyCreateSchema = z.object({
  student_id: z.string().min(1),
  rule_id: z.string().min(1),
  occurred_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().optional().nullable()
});

export const ResetSchema = z.object({
  student_id: z.string().min(1),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export const ThresholdSchema = z.object({
  id: z.string().min(1),
  min_points: z.number().int(),
  label: z.string().min(1),
  message_template: z.string().optional().nullable().default(""),
  sort_order: z.number().int().optional()
});

export const NoteSchema = z.object({
  id: z.string().min(1),
  student_id: z.string().min(1),
  noted_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string().min(1)
});

export const SmsSendSchema = z.object({
  student_id: z.string().min(1),
  target: z.enum(["student", "parent", "both"]),
  message: z.string().min(1)
});
