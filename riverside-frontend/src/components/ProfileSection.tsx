import { type FormEvent } from "react";

import type { MemberProfileRecord, User } from "../types";

interface ProfileSectionProps {
  profile: MemberProfileRecord | null;
  user: User | null;
  membershipStatus: string;
  profileName: string;
  profilePhone: string;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
}

export default function ProfileSection({
  profile,
  user,
  membershipStatus,
  profileName,
  profilePhone,
  onNameChange,
  onPhoneChange,
  onSave,
}: ProfileSectionProps) {
  return (
    <section
      style={{
        background: "white",
        borderRadius: 18,
        padding: "1.5rem",
        boxShadow: "0 8px 20px rgba(0,0,0,0.04)",
      }}
    >
      <h1 style={{ marginTop: 0 }}>Member dashboard</h1>
      <p>
        <strong>Name:</strong> {profile?.full_name ?? user?.fullName}
      </p>
      <p>
        <strong>Email:</strong> {user?.email}
      </p>
      <p>
        <strong>Membership:</strong> {user?.membershipTier ?? "Standard"}
      </p>
      <p>
        <strong>Status:</strong> {membershipStatus.replace("_", " ")}
      </p>
      <form
        onSubmit={onSave}
        style={{ display: "grid", gap: "0.6rem", maxWidth: 520 }}
      >
        <label>
          Full name
          <input
            required
            value={profileName}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label>
          Phone
          <input
            value={profilePhone}
            onChange={(event) => onPhoneChange(event.target.value)}
          />
        </label>
        <button type="submit">Save profile</button>
      </form>
    </section>
  );
}
