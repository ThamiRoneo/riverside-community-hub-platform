import { z } from "zod";

export const SignupSchema = z.object({
  email: z.string().email().min(5),
  password: z.string().min(8).max(100),
  full_name: z.string().min(2),
});

export const LoginSchema = z.object({
  email: z.string().email().min(5),
  password: z.string().min(8),
});

export const ReauthenticateSchema = z.object({
  email: z.string().email().min(5),
  password: z.string().min(8),
});

export const MemberCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(2),
});

export const MemberUpdateSchema = z.object({
  role: z.enum(["visitor", "member", "staff", "admin"]),
});

export const MemberProfileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  phone: z.string().max(30).optional(),
});

export const BookingCreateSchema = z
  .object({
    facility_id: z.string().uuid().optional(),
    equipment_id: z.string().uuid().optional(),
    start_at: z.string().datetime(),
    end_at: z.string().datetime(),
  })
  .refine(
    (value) => Boolean(value.facility_id) !== Boolean(value.equipment_id),
    { message: "Provide exactly one facility_id or equipment_id" },
  );

export const BookingApproveSchema = z.object({
  staff_note: z.string().min(1),
});

export const BookingRejectSchema = z.object({
  staff_note: z.string().min(1),
});

export const DonationCreateSchema = z.object({
  campaign_id: z.string(),
  amount: z.number().positive(),
  donor_name: z.string().optional(),
  donor_email: z.string().optional(),
  donor_phone: z.string().optional(),
  type: z.enum(["one_off", "monthly"]).default("one_off"),
  anonymous: z.boolean().default(false),
  receipt_opt_in: z.boolean().default(false),
  staff_note: z.string().optional(),
});

export const FacilityCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  capacity: z.number().int().positive().max(1000),
  hourly_rate: z.number().positive(),
  active: z.boolean().default(true),
});

export const FacilityUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  capacity: z.number().int().positive().max(1000).optional(),
  hourly_rate: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export const EquipmentCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().int().positive().default(1),
  active: z.boolean().default(true),
});

export const EquipmentUpdateSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  active: z.boolean().optional(),
});

export const CampaignCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  goal_amount: z.number().positive().optional(),
  active: z.boolean().default(true),
});

export const CampaignUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  goal_amount: z.number().positive().optional(),
  active: z.boolean().optional(),
});

export const ProgrammeCreateSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  age_range: z.string().optional(),
  schedule_info: z.string().optional(),
  active: z.boolean().default(true),
  image_url: z.string().optional(),
});

export const ProgrammeUpdateSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  age_range: z.string().optional(),
  schedule_info: z.string().optional(),
  active: z.boolean().optional(),
  image_url: z.string().optional(),
});
