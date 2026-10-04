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

// Must stay in sync with the public.user_role enum in migration 0001.
export const MemberUpdateSchema = z.object({
  role: z.enum(["member", "staff", "admin"]),
});

// POST /api/staff/invite: the admin decides the role at invite time, so it is
// required here rather than defaulted to the trigger's "member".
export const StaffInviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["staff", "admin"]),
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

// POST /api/bookings. The contract names one `resource_id` and the member-facing
// fields `purpose`, `people_count` and `contact_phone`. The route resolves the
// resource to its underlying table before writing.
export const BookingCreateSchema = z
  .object({
    resource_id: z.string().uuid(),
    start_time: z.string().datetime(),
    end_time: z.string().datetime(),
    purpose: z.string().min(2),
    accessibility_notes: z.string().max(500).optional(),
    contact_phone: z.string().min(5).max(30),
    people_count: z.number().int().positive().max(1000),
  })
  .refine((value) => value.end_time > value.start_time, {
    message: "end_time must be after start_time",
    path: ["end_time"],
  });

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

// POST /api/resources: `type` picks the underlying table, so it is required
// rather than inferred. Facilities are rooms; equipment keeps its own quantity.
export const ResourceCreateSchema = z.object({
  name: z.string().min(1),
  type: z.enum(["room", "equipment"]),
  capacity: z.number().int().positive().max(1000),
  description: z.string().optional().default(""),
});

export const ResourceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  capacity: z.number().int().positive().max(1000).optional(),
  description: z.string().optional(),
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
