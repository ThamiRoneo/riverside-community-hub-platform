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

// Must stay in sync with the public.user_role enum in migration 0001.
export const MemberUpdateSchema = z.object({
  role: z.enum(["member", "staff", "admin"]),
});

// Wire format uses `contact_phone` per the API contract; the profiles table
// column is `phone`. The mapping belongs in the route, not the schema.
export const MemberProfileUpdateSchema = z.object({
  full_name: z.string().min(2).optional(),
  contact_phone: z.string().max(30).nullable().optional(),
});

// POST /api/profile/complete: identity is required, phone is not.
export const ProfileCompleteSchema = z.object({
  full_name: z.string().min(2),
  contact_phone: z.string().max(30).nullable().optional(),
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

// Donation types and statuses are defined by the API contract and must match
// the public.donation_type / donation_status enums (migration 0005).
export const DonationTypeSchema = z.enum(["one_off", "pledge_intent"]);

export const DonationCreateSchema = z.object({
  campaign_id: z.string().uuid(),
  amount: z.number().positive(),
  donor_name: z.string().optional(),
  donor_email: z.string().email().optional(),
  donor_phone: z.string().optional(),
  type: DonationTypeSchema.default("one_off"),
  anonymous: z.boolean().default(false),
  receipt_opt_in: z.boolean().default(false),
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
