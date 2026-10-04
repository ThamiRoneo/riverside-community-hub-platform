import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CampaignManagement from "./CampaignManagement";

const apiGet = vi.fn();
const apiPost = vi.fn();
const apiPatch = vi.fn();

vi.mock("../lib/api", () => ({
  apiGet: (...args: unknown[]) => apiGet(...args),
  apiPost: (...args: unknown[]) => apiPost(...args),
  apiPatch: (...args: unknown[]) => apiPatch(...args),
  apiDelete: vi.fn(),
  reauthenticate: vi.fn(),
}));

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "admin-1", role: "admin" } }),
}));

const campaigns = [
  {
    id: "camp-1",
    title: "Winter Food Parcels",
    description: "Feed the community",
    goal_amount: 50000,
    current_amount: 34450,
    progress_pct: 69,
  },
  {
    id: "camp-2",
    title: "Open Appeal",
    description: null,
    goal_amount: null,
    current_amount: 1200,
    progress_pct: null,
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
  apiGet.mockResolvedValue({ campaigns });
  apiPost.mockResolvedValue({ message: "Campaign created" });
  apiPatch.mockResolvedValue({ message: "Campaign updated" });
});

describe("CampaignManagement", () => {
  it("shows the raised amount and progress for each campaign", async () => {
    render(<CampaignManagement />);

    expect(await screen.findByText("Winter Food Parcels")).toBeInTheDocument();
    expect(screen.getByText(/34,450 of 50,000 · 69%/)).toBeInTheDocument();
  });

  it("describes a campaign with no goal instead of showing a percentage", async () => {
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    // progress_pct is null when no goal is set, so a percentage would be a
    // claim about a number that does not exist.
    expect(screen.getByText(/no goal set/i)).toBeInTheDocument();
    expect(rowFor("Open Appeal")).not.toHaveTextContent("%");
  });

  it("creates a campaign with a numeric goal", async () => {
    const user = userEvent.setup();
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    await user.type(screen.getByLabelText(/add a campaign/i), "Summer Fund");
    await user.type(screen.getByLabelText(/goal amount/i), "25000");
    submitForm(/add a campaign/i);

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith("/campaigns", {
        title: "Summer Fund",
        // The column is numeric, so the form's string becomes a number.
        goal_amount: 25000,
      });
    });
  });

  it("omits a blank goal rather than sending zero", async () => {
    const user = userEvent.setup();
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    await user.type(screen.getByLabelText(/add a campaign/i), "No Goal Needed");
    submitForm(/add a campaign/i);

    await waitFor(() => {
      // Zero would read as a real goal of nothing, which is a different claim
      // from "no goal was set".
      expect(apiPost).toHaveBeenCalledWith("/campaigns", {
        title: "No Goal Needed",
      });
    });
  });

  it("edits a campaign through the prefilled form", async () => {
    const user = userEvent.setup();
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    await user.click(
      within(rowFor("Winter Food Parcels")).getByRole("button", {
        name: /edit winter food parcels/i,
      }),
    );

    const editForm = screen
      .getByLabelText(/edit campaign \(was winter food parcels\)/i)
      .closest("form")!;
    const title = within(editForm).getByLabelText("Title");
    expect(title).toHaveValue("Winter Food Parcels");
    expect(within(editForm).getByLabelText(/goal amount/i)).toHaveValue(50000);

    await user.clear(title);
    await user.type(title, "Winter Parcels 2026");
    submitForm(/edit campaign/i);

    await waitFor(() => {
      expect(apiPatch).toHaveBeenCalledWith("/campaigns/camp-1", {
        title: "Winter Parcels 2026",
        description: "Feed the community",
        goal_amount: 50000,
      });
    });
  });

  it("has no delete, because deleting would take the donations with it", async () => {
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    expect(
      within(rowFor("Winter Food Parcels")).queryByRole("button", {
        name: /delete/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("shows the server's refusal instead of reporting success", async () => {
    const user = userEvent.setup();
    apiPatch.mockRejectedValue(new Error("Invalid payload"));
    render(<CampaignManagement />);
    await screen.findByText("Winter Food Parcels");

    await user.click(
      within(rowFor("Winter Food Parcels")).getByRole("button", {
        name: /edit winter food parcels/i,
      }),
    );
    submitForm(/edit campaign/i);

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid payload");
  });
});