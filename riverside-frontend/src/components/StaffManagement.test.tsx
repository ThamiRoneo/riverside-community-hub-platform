import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import StaffManagement from "./StaffManagement";

/**
 * The api module is mocked rather than fetch, so these tests pin what the
 * component asks the API for and how it reacts to a refusal. They do not
 * duplicate the backend suite, which already covers the routes themselves
 * against a real database.
 */
const apiGet = vi.fn();
const apiPatch = vi.fn();
const apiPost = vi.fn();
const reauthenticate = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPatch: (...args: unknown[]) => apiPatch(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  reauthenticate: (...args: unknown[]) => reauthenticate(...args),
}));

let currentUser = { id: "admin-1", fullName: "Riverside Admin" };
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: currentUser }),
}));

const staff = [
  {
    id: "admin-1",
    full_name: "Riverside Admin",
    role: "admin" as const,
    joined_at: "2026-09-23T11:19:59.544Z",
    active: true,
  },
  {
    id: "staff-1",
    full_name: "Riverside Staff",
    role: "staff" as const,
    joined_at: "2026-09-23T11:19:55.203Z",
    active: true,
  },
];

/**
 * Submits a form directly rather than clicking its submit button.
 *
 * Clicking a submit button makes jsdom call HTMLFormElement.requestSubmit,
 * which jsdom defines but never implemented: it logs "Not implemented" on
 * every submit. The submit event still reaches React, so the assertions passed
 * while the run filled with noise that would hide a real failure. Submitting the
 * form reaches the same onSubmit handler without the broken path.
 */
function submitForm(label: RegExp) {
  fireEvent.submit(screen.getByLabelText(label).closest("form")!);
}

/** Two rows both carry a Deactivate button, so scope to the intended row. */
function deactivateButtonFor(name: string) {
  const row = screen.getByText(name).closest("li")!;
  return within(row).getByRole("button", { name: /deactivate/i });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = { id: "admin-1", fullName: "Riverside Admin" };
  apiGet.mockResolvedValue({ staff });
  apiPatch.mockResolvedValue({ id: "staff-1", active: false });
  apiPost.mockResolvedValue({ invite_id: "invite-1", status: "pending" });
  reauthenticate.mockResolvedValue("reauth-token");
});

describe("StaffManagement", () => {
  it("lists staff with their role and join date", async () => {
    render(<StaffManagement />);

    expect(await screen.findByText("Riverside Staff")).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/staff");
    expect(screen.getAllByText(/joined/)).toHaveLength(2);
  });

  it("says so when there are no staff accounts", async () => {
    apiGet.mockResolvedValue({ staff: [] });
    render(<StaffManagement />);

    expect(
      await screen.findByText(/no staff accounts yet/i),
    ).toBeInTheDocument();
  });

  it("reports a failed load instead of showing an empty list", async () => {
    apiGet.mockRejectedValue(new Error("boom"));
    render(<StaffManagement />);

    // An empty list would read as "no staff", which is the opposite of a
    // failure, so the error has to be distinguishable from it.
    expect(await screen.findByRole("alert")).toHaveTextContent(/unable to load/i);
    expect(screen.queryByText(/no staff accounts yet/i)).not.toBeInTheDocument();
  });

  it("re-authenticates before sending an invite and reloads afterwards", async () => {
    const user = userEvent.setup();
    render(<StaffManagement />);
    await screen.findByText("Riverside Staff");

    await user.type(
      screen.getByLabelText(/invite a colleague/i),
      "newcomer@example.com",
    );
    submitForm(/invite a colleague/i);

    // Submitting only stages it. The contract gates the invite behind a fresh
    // password check, so nothing is sent until it is confirmed.
    expect(apiPost).not.toHaveBeenCalled();
    expect(
      screen.getByText(/confirm the invite to newcomer@example.com/i),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/confirm the invite/i),
      "Password123",
    );
    submitForm(/confirm the invite/i);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith(
        "/staff/invite",
        { email: "newcomer@example.com", role: "staff" },
        { "X-Reauth-Token": "reauth-token" },
      );
    });
    // Reloaded, so a newly invited colleague appears without a refresh.
    expect(apiGet).toHaveBeenCalledTimes(2);
  });

  it("deactivates after re-authenticating and reflects the new state", async () => {
    const user = userEvent.setup();
    apiGet
      .mockResolvedValueOnce({ staff })
      .mockResolvedValueOnce({
        staff: staff.map((person) =>
          person.id === "staff-1" ? { ...person, active: false } : person,
        ),
      });
    render(<StaffManagement />);
    await screen.findByText("Riverside Staff");

    await user.click(deactivateButtonFor("Riverside Staff"));
    expect(apiPatch).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText(/confirm deactivating riverside staff/i),
      "Password123",
    );
    submitForm(/confirm deactivating/i);

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith(
        "/staff/staff-1/deactivate",
        {},
        { "X-Reauth-Token": "reauth-token" },
      );
    });
    // Deactivation is stated in words, not only in colour.
    expect(await screen.findByText(/deactivated/i)).toBeInTheDocument();
  });

  it("surfaces the server's refusal when the last admin cannot be deactivated", async () => {
    const user = userEvent.setup();
    apiPatch.mockRejectedValue(
      new Error("You cannot deactivate the last active admin"),
    );
    render(<StaffManagement />);
    await screen.findByText("Riverside Staff");

    await user.click(deactivateButtonFor("Riverside Staff"));
    await user.type(
      screen.getByLabelText(/confirm deactivating riverside staff/i),
      "Password123",
    );
    submitForm(/confirm deactivating/i);

    expect(
      await screen.findByText(/cannot deactivate the last active admin/i),
    ).toBeInTheDocument();
  });

  it("will not let an admin deactivate their own account", async () => {
    render(<StaffManagement />);
    await screen.findByText("Riverside Staff");

    // The row is still listed, but the button is dead: deactivating yourself
    // ends the session doing it, so the server would refuse it anyway.
    expect(deactivateButtonFor("Riverside Admin")).toBeDisabled();
    // Somebody else's row is unaffected.
    expect(deactivateButtonFor("Riverside Staff")).toBeEnabled();
  });
});