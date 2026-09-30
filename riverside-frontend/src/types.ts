// Must stay in sync with the public.user_role enum in migration 0001.
export type Role = "member" | "staff" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  membershipTier?: string;
  joinedAt?: string;
  membershipExpiresAt?: string | null;
}

export interface Programme {
  id: string;
  title: string;
  ageRange: string;
  schedule: string;
  description: string;
  image: string;
}

export interface Resource {
  id: string;
  name: string;
  type: "room" | "equipment";
  capacity?: number;
  description: string;
  hourlyRate: number;
  availability: "Available" | "Busy" | "Limited";
}

export interface Booking {
  id: string;
  title: string;
  member: string;
  resource: string;
  date: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
}

export interface DonationCampaign {
  id: string;
  title: string;
  goalAmount: number;
  currentAmount: number;
  description: string;
}

export interface ProgrammeRecord {
  id: string;
  title: string;
  description: string | null;
  age_range: string | null;
  schedule_info: string | null;
  image_url: string | null;
}

/** Rooms and equipment share one catalogue endpoint, so one record covers both. */
export type ResourceType = "room" | "equipment";

export interface ResourceRecord {
  id: string;
  name: string;
  type: ResourceType;
  description: string | null;
  capacity: number | null;
  /** Rooms are charged hourly; equipment has no rate. */
  hourly_rate: number | null;
}

export interface CampaignRecord {
  id: string;
  title: string;
  description: string | null;
  goal_amount: number | null;
  current_amount: number;
}

export interface BookingRecord {
  id: string;
  member_id: string;
  resource_id: string | null;
  resource_type: ResourceType | null;
  resource_name: string | null;
  member_name: string | null;
  purpose: string | null;
  contact_phone: string | null;
  people_count: number | null;
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  staff_note?: string | null;
  /** Only the staff queue reports a clash with an already-approved booking. */
  has_conflict?: boolean;
}

export interface ReportRecord {
  bookings_this_month: number;
  bookings_delta_pct: number;
  donations_total: number;
  donations_delta_pct: number;
  active_members: number;
  active_members_delta: number;
  pending_requests: number;
  conflict_count: number;
  bookings_by_status: { status: string; count: number }[];
  donations_over_time: { date: string; total: number; count: number }[];
  generated_at: string;
}

// GET /api/members returns raw profile rows, which use the `phone` column.
export interface MemberRecord {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  membership_tier: string | null;
  membership_expires_at: string | null;
  created_at: string;
}

// GET /api/profile/me follows the API contract, which renames `phone` to
// `contact_phone` and adds the computed `expiring_soon` flag.
export interface MemberProfileRecord {
  id: string;
  full_name: string;
  contact_phone: string | null;
  role: Role;
  membership_tier: string;
  membership_expires_at: string | null;
  joined_at: string;
  created_at: string;
  expiring_soon: boolean;
}

// Donation types and statuses follow the API contract and must match the
// public.donation_type / donation_status enums (migration 0005).
export type DonationType = "one_off" | "pledge_intent";
export type DonationStatus =
  | "paid"
  | "pending_followup"
  | "followed_up"
  | "cancelled";

export interface DonationRecord {
  id: string;
  campaign_id: string;
  amount: number;
  type: DonationType;
  status: DonationStatus;
  receipt_reference: string | null;
  donor_name: string | null;
  donor_email: string | null;
  anonymous: boolean;
  staff_note: string | null;
  created_at: string;
  campaigns?: { title?: string } | null;
}

export interface NotificationRecord {
  id: string;
  booking_id: string | null;
  message: string;
  read: boolean;
  created_at: string;
}
