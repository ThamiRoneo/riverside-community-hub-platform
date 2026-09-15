import type { Booking, DonationCampaign, Programme, Resource } from "../types";

export const programmes: Programme[] = [
  {
    id: "prog-1",
    title: "Youth Coding Club",
    ageRange: "12-17",
    schedule: "Tuesdays, 4:00 PM",
    description:
      "Build digital skills with project-based learning and mentorship.",
    image:
      "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "prog-2",
    title: "Community Fitness",
    ageRange: "18+",
    schedule: "Wednesdays, 6:00 PM",
    description: "Low-cost fitness sessions designed for community wellbeing.",
    image:
      "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: "prog-3",
    title: "Family Arts Workshop",
    ageRange: "All ages",
    schedule: "Saturdays, 10:00 AM",
    description: "Hands-on creative sessions for families and caregivers.",
    image:
      "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?auto=format&fit=crop&w=900&q=80",
  },
];

export const resources: Resource[] = [
  {
    id: "res-1",
    name: "Boardroom A",
    type: "room",
    capacity: 12,
    description: "Ideal for community meetings and executive sessions.",
    hourlyRate: 180,
    availability: "Available",
  },
  {
    id: "res-2",
    name: "Community Hall",
    type: "room",
    capacity: 50,
    description: "Spacious room for events and trainings.",
    hourlyRate: 420,
    availability: "Limited",
  },
  {
    id: "res-3",
    name: "Gym Equipment Set",
    type: "equipment",
    description: "Portable fitness equipment bundle for training sessions.",
    hourlyRate: 95,
    availability: "Available",
  },
  {
    id: "res-4",
    name: "Projector Kit",
    type: "equipment",
    description: "Projector and screen package for presentations.",
    hourlyRate: 130,
    availability: "Busy",
  },
];

export const bookings: Booking[] = [
  {
    id: "bk-1",
    title: "Boardroom A booking",
    member: "Aisha M.",
    resource: "Boardroom A",
    date: "2026-09-18",
    status: "pending",
  },
  {
    id: "bk-2",
    title: "Gym equipment request",
    member: "David L.",
    resource: "Gym Equipment Set",
    date: "2026-09-19",
    status: "approved",
  },
  {
    id: "bk-3",
    title: "Community hall event",
    member: "Nandi P.",
    resource: "Community Hall",
    date: "2026-09-21",
    status: "rejected",
  },
];

export const donationCampaigns: DonationCampaign[] = [
  {
    id: "campaign-1",
    title: "Winter Food Parcels",
    goalAmount: 50000,
    currentAmount: 28600,
    description:
      "Help Riverside support households with winter food parcels and essential groceries.",
  },
];
