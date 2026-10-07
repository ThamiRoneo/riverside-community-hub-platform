import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MemberDashboard from "./MemberDashboard";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiPatch: (...args: unknown[]) => apiPatch(...args),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "m-1", fullName: "Aisha" } }),
}));

const resource = {
  id: "res-1",
  name: "Main Hall",
  type: "room" as const,
  description: null,
  capacity: 120,
  hourly_rate: 20,
};

const profile = {
  id: "m-1",
  full_name: "Aisha",
  contact_phone: "07123456789",
  role: "member" as const,
  membership_tier: "free",
  membership_expires_at: null,
  joined_at: "2026-09-23T11:20:06.159Z",
  created_at: "2026-09-23T11:20:06.159Z",
  expiring_soon: false,
};

/** Four open hours and one already approved booking in the middle. */
function slotsFor(hours: ("available" | "unavailable")[]) {
  return hours.map((status, index) => ({
    start_time: `2026-10-06T${String(9 + index).padStart(2, "0")}:00:00.000Z`,
    end_time: `2026-10-06T${String(10 + index).padStart(2, "0")}:00:00.000Z`,
    status,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  apiGet.mockImplementation((path: string) => {
    if (path === "/bookings/mine")
      return Promise.resolve({ bookings: [], total: 0 });
    if (path === "/resources?page_size=100")
      return Promise.resolve({ resources: [resource], total: 1 });
    if (path === "/profile/me") return Promise.resolve(profile);
    if (path === "/notifications")
      return Promise.resolve({ notifications: [], total: 0 });
    if (path.includes("/availability"))
      return Promise.resolve({
        slots: slotsFor([
          "available",
          "unavailable",
          "unavailable",
          "available",
        ]),
      });
    return Promise.reject(new Error(`unexpected GET ${path}`));
  });
  apiPost.mockResolvedValue({ id: "b-1", status: "pending" });
  apiPatch.mockResolvedValue(profile);
});

/** Picks the resource and start/end times the availability check keys off. */
async function chooseBookingWindow(
  startLocal = "2026-10-06T10:00",
  endLocal = "2026-10-06T11:00",
) {
  // user-event is imported inside the helper rather than at the top so the
  // fake-timers check it runs stays the last thing that happens in the file.
  const { default: userEvent } = await import("@testing-library/user-event");
  const user = userEvent.setup();
  render(<MemberDashboard />);
  // The resource options only exist once the catalogue has loaded, so wait for
  // Main Hall rather than for the empty select that renders first.
  await screen.findByRole("option", { name: "Main Hall" });
  await user.selectOptions(
    screen.getByLabelText(/choose a room or equipment/i),
    "res-1",
  );
  await user.type(screen.getByLabelText(/start time/i), startLocal);
  await user.type(screen.getByLabelText(/end time/i), endLocal);
  return user;
}

describe("MemberDashboard availability", () => {
  it("asks for the chosen resource and the date of the chosen start", async () => {
    await chooseBookingWindow();

    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/resources/res-1/availability?date=2026-10-06",
      );
    });
  });

  it("warns when the requested hours are already booked", async () => {
    // 10:00 and 11:00 are the two unavailable slots.
    await chooseBookingWindow("2026-10-06T10:00", "2026-10-06T12:00");

    expect(
      await screen.findByText(/some of that time is already booked/i),
    ).toBeInTheDocument();
  });

  it("stays quiet when the requested hours are free", async () => {
    // 09:00-10:00 and 12:00-13:00 are available.
    await chooseBookingWindow("2026-10-06T12:00", "2026-10-06T13:00");

    // Give the fetch time to land before asserting the absence.
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/resources/res-1/availability?date=2026-10-06",
      );
    });
    expect(
      screen.queryByText(/some of that time is already booked/i),
    ).not.toBeInTheDocument();
  });

  it("does not warn when the availability request fails", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path.includes("/availability"))
        return Promise.reject(new Error("boom"));
      if (path === "/bookings/mine")
        return Promise.resolve({ bookings: [], total: 0 });
      if (path === "/resources?page_size=100")
        return Promise.resolve({ resources: [resource], total: 1 });
      if (path === "/profile/me") return Promise.resolve(profile);
      if (path === "/notifications")
        return Promise.resolve({ notifications: [], total: 0 });
      return Promise.reject(new Error(`unexpected GET ${path}`));
    });

    await chooseBookingWindow();

    // Availability is advisory. A failure must not block the form, because the
    // backend refuses a clashing booking with a 409 regardless.
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/resources/res-1/availability?date=2026-10-06",
      );
    });
    expect(
      screen.queryByText(/some of that time is already booked/i),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /request booking/i })).toBeEnabled();
  });

  it("still lets the member submit a clashing request for staff to judge", async () => {
    const user = await chooseBookingWindow("2026-10-06T10:00", "2026-10-06T11:00");
    await screen.findByText(/some of that time is already booked/i);

    // Blocking would be wrong: only an approved booking blocks a slot, and two
    // members are allowed to request the same hour.
    const submit = screen.getByRole("button", { name: /request booking/i });
    expect(submit).toBeEnabled();

    await user.type(screen.getByLabelText(/purpose/i), "Community meeting");
    await user.click(submit);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/bookings",
        expect.objectContaining({ resource_id: "res-1" }),
      );
    });
  });
});