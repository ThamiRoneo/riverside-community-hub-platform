import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiGet, apiPost, apiPatch } from "../lib/api";
import type {
  BookingRecord,
  MemberProfileRecord,
  NotificationRecord,
  ResourceRecord,
} from "../types";
import BookingForm from "../components/BookingForm";
import BookingList from "../components/BookingList";
import NotificationsSection from "../components/NotificationsSection";
import ProfileSection from "../components/ProfileSection";

export default function MemberDashboard() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [resources, setResources] = useState<ResourceRecord[]>([]);
  const [profile, setProfile] = useState<MemberProfileRecord | null>(null);
  const [membershipStatus, setMembershipStatus] = useState("not_set");
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [resourceId, setResourceId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [purpose, setPurpose] = useState("");
  const [peopleCount, setPeopleCount] = useState("1");
  const [accessibilityNotes, setAccessibilityNotes] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [message, setMessage] = useState("");

  async function loadBookings() {
    const response = await apiGet<{ bookings: BookingRecord[] }>(
      "/bookings/mine",
    );
    setBookings(response.bookings);
  }

  useEffect(() => {
    Promise.all([
      loadBookings(),
      apiGet<{ resources: ResourceRecord[] }>("/resources?page_size=100"),
      apiGet<MemberProfileRecord>("/profile/me"),
      apiGet<{ notifications: NotificationRecord[] }>("/notifications"),
    ])
      .then(
        ([, resourceResponse, profileResponse, notificationResponse]) => {
          setResources(resourceResponse.resources);
          setProfile(profileResponse);
          setMembershipStatus(
            profileResponse.expiring_soon ? "expiring_soon" : "active",
          );
          setProfileName(profileResponse.full_name);
          setProfilePhone(profileResponse.contact_phone ?? "");
          setNotifications(notificationResponse.notifications);
          setStatus("ready");
        },
      )
      .catch(() => setStatus("error"));
  }, []);

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    try {
      await apiPost("/bookings", {
        resource_id: resourceId,
        start_time: new Date(startAt).toISOString(),
        end_time: new Date(endAt).toISOString(),
        purpose,
        contact_phone: profilePhone,
        people_count: Number(peopleCount),
        ...(accessibilityNotes
          ? { accessibility_notes: accessibilityNotes }
          : {}),
      });
      await loadBookings();
      setMessage("Booking request submitted for staff approval.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to create booking",
      );
    }
  }

  async function cancelBooking(id: string) {
    try {
      await apiPatch(`/bookings/${id}/cancel`, {});
      await loadBookings();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to cancel booking",
      );
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const response = await apiPatch<MemberProfileRecord>(
        "/profile/me",
        { full_name: profileName, contact_phone: profilePhone || null },
      );
      setProfile(response);
      setProfilePhone(response.contact_phone ?? "");
      setMessage("Profile updated successfully.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to update profile",
      );
    }
  }

  async function markNotificationRead(id: string) {
    try {
      await apiPatch(`/notifications/${id}/read`, {});
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === id
            ? { ...notification, read: true }
            : notification,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update notification",
      );
    }
  }

  return (
    <div style={{ display: "grid", gap: "1.5rem" }}>
      <ProfileSection
        profile={profile}
        user={user}
        membershipStatus={membershipStatus}
        profileName={profileName}
        profilePhone={profilePhone}
        onNameChange={setProfileName}
        onPhoneChange={setProfilePhone}
        onSave={saveProfile}
      />
      <NotificationsSection
        notifications={notifications}
        onRead={markNotificationRead}
      />
      <BookingForm
        resources={resources}
        resourceId={resourceId}
        startAt={startAt}
        endAt={endAt}
        purpose={purpose}
        peopleCount={peopleCount}
        accessibilityNotes={accessibilityNotes}
        status={status}
        message={message}
        onResourceChange={setResourceId}
        onStartChange={setStartAt}
        onEndChange={setEndAt}
        onPurposeChange={setPurpose}
        onPeopleChange={setPeopleCount}
        onNotesChange={setAccessibilityNotes}
        onSubmit={handleBookingSubmit}
      />
      <BookingList bookings={bookings} status={status} onCancel={cancelBooking} />
    </div>
  );
}
