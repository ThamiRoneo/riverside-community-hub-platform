export type Role = "visitor" | "member" | "staff" | "admin";

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

export interface FacilityRecord {
  id: string;
  name: string;
  description: string | null;
  capacity: number | null;
  hourly_rate: number;
}

export interface EquipmentRecord {
  id: string;
  name: string;
  description: string | null;
  quantity: number;
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
  facility_id: string | null;
  equipment_id: string | null;
  start_at: string;
  end_at: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  staff_note?: string | null;
  profiles?: { full_name?: string; email?: string } | null;
  facilities?: { name?: string } | null;
  equipment?: { name?: string } | null;
}

export interface ReportRecord {
  bookings_this_month: number;
  total_donations: number;
  active_members: number;
  generated_at: string;
}

export interface MemberRecord {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  membership_expires_at: string | null;
  created_at: string;
}

export interface MemberProfileRecord {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  membership_expires_at: string | null;
  created_at: string;
}

export interface DonationRecord {
  id: string;
  campaign_id: string;
  amount: number;
  type: "one_off" | "monthly";
  status: "pending_followup" | "followed_up";
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
