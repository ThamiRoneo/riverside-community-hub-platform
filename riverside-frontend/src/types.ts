export type Role = "visitor" | "member" | "staff" | "admin";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  membershipTier?: string;
  joinedAt?: string;
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
