import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProgrammeManagement from "./ProgrammeManagement";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();
const apiDelete = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiPatch: (...args: unknown[]) => apiPatch(...args),
  apiDelete: (...args: unknown[]) => apiDelete(...args),
}));

let currentRole: "admin" | "staff" = "admin";
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1", role: currentRole } }),
}));

const programmes = [
  {
    id: "prog-1",
    title: "After School Club",
    description: "Homework help",
    age_range: "5-12",
    schedule_info: "Mon 16:00",
    image_url: null,
  },
];

function submitForm(label: RegExp) {
  fireEvent.submit(screen.getByLabelText(label).closest("form")!);
}

function rowFor(title: string) {
  return screen.getByText(title).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "admin";
  apiGet.mockResolvedValue({ programmes });
  apiPost.mockResolvedValue({ message: "Programme created" });
  apiPatch.mockResolvedValue({ message: "Programme updated" });
  apiDelete.mockResolvedValue(undefined);
});

describe("ProgrammeManagement", () => {
  it("lists programmes with their age range and schedule", async () => {
    render(<ProgrammeManagement />);

    expect(await screen.findByText("After School Club")).toBeInTheDocument();
    expect(screen.getByText(/5-12 · Mon 16:00/)).toBeInTheDocument();
  });

  it("says so when there are no programmes", async () => {
    apiGet.mockResolvedValue({ programmes: [] });
    render(<ProgrammeManagement />);

    expect(
      await screen.findByText(/no active programmes yet/i),
    ).toBeInTheDocument();
  });

  it("creates a programme from the add form", async () => {
    const user = userEvent.setup();
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    await user.type(
      screen.getByLabelText(/add a programme/i),
      "Saturday Football",
    );
    await user.type(screen.getByLabelText("Age range"), "7-14");
    await user.type(screen.getByLabelText("Schedule"), "Sat 10:00");
    submitForm(/add a programme/i);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/programmes", {
        title: "Saturday Football",
        age_range: "7-14",
        schedule_info: "Sat 10:00",
      });
    });
  });

  it("omits blank optional fields instead of sending empty strings", async () => {
    const user = userEvent.setup();
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    await user.type(screen.getByLabelText(/add a programme/i), "Just A Title");
    submitForm(/add a programme/i);

    await waitFor(() => {
      // Sending "" would overwrite the column with an empty string instead of
      // leaving it alone.
      expect(apiPost).toHaveBeenCalledWith("/programmes", {
        title: "Just A Title",
      });
    });
  });

  it("edits a programme through the prefilled form", async () => {
    const user = userEvent.setup();
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    await user.click(
      within(rowFor("After School Club")).getByRole("button", {
        name: /edit after school club/i,
      }),
    );

    // Prefilled from the record rather than blank.
    const title = screen.getByLabelText(/edit programme \(was after school club\)/i);
    expect(title).toHaveValue("After School Club");

    await user.clear(title);
    await user.type(title, "After School Homework Club");
    submitForm(/edit programme/i);

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith("/programmes/prog-1", {
        title: "After School Homework Club",
        age_range: "5-12",
        schedule_info: "Mon 16:00",
        description: "Homework help",
      });
    });
  });

  it("confirms before deleting and reports the outcome", async () => {
    const user = userEvent.setup();
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    await user.click(
      within(rowFor("After School Club")).getByRole("button", {
        name: /delete after school club/i,
      }),
    );

    // Deleting is destructive, so nothing has happened yet.
    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yes, delete it/i }));
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/programmes/prog-1");
    });
  });

  it("hides delete from staff, who may not delete", async () => {
    currentRole = "staff";
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    // The contract grants delete to admins only, so staff get no button rather
    // than one that fails with a 403.
    expect(
      within(rowFor("After School Club")).queryByRole("button", {
        name: /delete/i,
      }),
    ).not.toBeInTheDocument();
    // Creating and editing are staff permissions, so they stay.
    expect(
      within(rowFor("After School Club")).getByRole("button", { name: /edit/i }),
    ).toBeInTheDocument();
  });

  it("shows the server's refusal instead of reporting success", async () => {
    const user = userEvent.setup();
    apiPost.mockRejectedValue(new Error("Invalid payload"));
    render(<ProgrammeManagement />);
    await screen.findByText("After School Club");

    await user.type(screen.getByLabelText(/add a programme/i), "Bad");
    submitForm(/add a programme/i);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid payload");
  });
});