import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import InventoryManagement from "./InventoryManagement";

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
  useAuth: () => ({ user: { id: "u-1", role: currentRole } }),
}));

const resources = [
  {
    id: "res-1",
    name: "Main Hall",
    type: "room" as const,
    description: "Main community hall",
    capacity: 120,
    hourly_rate: 20,
  },
  {
    id: "res-2",
    name: "Projector",
    type: "equipment" as const,
    description: null,
    capacity: null,
    hourly_rate: null,
  },
];

function submitForm(label: RegExp) {
  fireEvent.submit(screen.getByLabelText(label).closest("form")!);
}

function rowFor(name: string) {
  return screen.getByText(name).closest("li")!;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentRole = "admin";
  apiGet.mockResolvedValue({ resources });
  apiPost.mockResolvedValue({ resource: resources[0] });
  apiPatch.mockResolvedValue({ resource: resources[0] });
  apiDelete.mockResolvedValue(undefined);
});

describe("InventoryManagement", () => {
  it("asks for the whole catalogue rather than the default page", async () => {
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    // The panel renders every row it is given, so the default page size of ten
    // would silently truncate the list.
    expect(apiGet).toHaveBeenCalledWith("/resources?page_size=100");
  });

  it("shows each resource with its type and capacity", async () => {
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    expect(rowFor("Main Hall")).toHaveTextContent("Room · Up to 120 people");
    // Equipment with no capacity says so rather than showing nothing.
    expect(rowFor("Projector")).toHaveTextContent(
      "Equipment · No capacity limit",
    );
  });

  it("creates a resource with its type", async () => {
    const user = userEvent.setup();
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    await user.type(
      screen.getByLabelText(/add a room or piece of equipment/i),
      "Garden Plot",
    );
    await user.selectOptions(screen.getByLabelText(/^type$/i), "equipment");
    await user.type(screen.getByLabelText(/^capacity$/i), "10");
    submitForm(/add a room or piece of equipment/i);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/resources", {
        name: "Garden Plot",
        type: "equipment",
        capacity: 10,
      });
    });
  });

  it("edits a resource through the prefilled form", async () => {
    const user = userEvent.setup();
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    await user.click(
      within(rowFor("Main Hall")).getByRole("button", {
        name: /edit main hall/i,
      }),
    );

    const editForm = screen
      .getByLabelText(/edit resource \(was main hall\)/i)
      .closest("form")!;
    expect(within(editForm).getByLabelText("Name")).toHaveValue("Main Hall");
    expect(within(editForm).getByLabelText(/^capacity$/i)).toHaveValue(120);

    await user.clear(within(editForm).getByLabelText("Name"));
    await user.type(within(editForm).getByLabelText("Name"), "Riverside Hall");
    fireEvent.submit(editForm);

    await waitFor(() => {
      // No `type` in the body: the contract's update has no such field, so a
      // resource cannot be moved between the room and equipment tables.
      expect(apiPatch).toHaveBeenCalledWith("/resources/res-1", {
        name: "Riverside Hall",
        capacity: 120,
        description: "Main community hall",
      });
    });
  });

  it("confirms before deleting and reports the outcome", async () => {
    const user = userEvent.setup();
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    await user.click(
      within(rowFor("Main Hall")).getByRole("button", {
        name: /delete main hall/i,
      }),
    );
    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.getByText(/can no longer be booked/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /yes, delete it/i }));
    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/resources/res-1");
    });
  });

  it("hides delete from staff, who may not delete", async () => {
    currentRole = "staff";
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    expect(
      within(rowFor("Main Hall")).queryByRole("button", { name: /delete/i }),
    ).not.toBeInTheDocument();
    // Creating and editing are staff permissions, so they stay.
    expect(
      within(rowFor("Main Hall")).getByRole("button", { name: /edit/i }),
    ).toBeInTheDocument();
  });

  it("says so when the catalogue is empty", async () => {
    apiGet.mockResolvedValue({ resources: [] });
    render(<InventoryManagement />);

    expect(
      await screen.findByText(/no rooms or equipment yet/i),
    ).toBeInTheDocument();
  });

  it("shows the server's refusal instead of reporting success", async () => {
    const user = userEvent.setup();
    apiDelete.mockRejectedValue(new Error("Resource not found"));
    render(<InventoryManagement />);
    await screen.findByText("Main Hall");

    await user.click(
      within(rowFor("Main Hall")).getByRole("button", {
        name: /delete main hall/i,
      }),
    );
    await user.click(screen.getByRole("button", { name: /yes, delete it/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Resource not found",
    );
  });
});