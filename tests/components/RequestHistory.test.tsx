import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RequestHistory from "../../src/components/RequestHistory";
import { createMockSupabaseClient } from "../helpers/mock-supabase";

let mockClient = createMockSupabaseClient();
let mockIsConfigured = true;

vi.mock("../../src/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured;
  },
  get supabase() {
    return mockClient;
  },
}));

describe("src/components/RequestHistory.tsx", () => {
  beforeEach(() => {
    mockIsConfigured = true;
    mockClient = createMockSupabaseClient();
  });

  it("displays configuration message if Supabase is not configured", () => {
    mockIsConfigured = false;
    render(<RequestHistory />);
    expect(screen.getByText(/request history is not configured yet/i)).toBeInTheDocument();
  });

  it("displays sign-in prompt for unauthenticated users", async () => {
    mockClient = createMockSupabaseClient({ user: null });
    render(<RequestHistory />);

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /sign in to view requests/i }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^sign in$/i })).toBeInTheDocument();
    });
  });

  it("opens the auth modal when sign-in button is clicked", async () => {
    mockClient = createMockSupabaseClient({ user: null });
    render(<RequestHistory />);

    const signInButton = await screen.findByRole("button", { name: /^sign in$/i });
    fireEvent.click(signInButton);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("shows empty state when authenticated user has no submitted requests", async () => {
    const user = { id: "user-123", email: "fan@example.com" };
    mockClient = createMockSupabaseClient({
      user,
      tableData: {
        requests: [],
      },
    });

    render(<RequestHistory />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /no requests yet/i })).toBeInTheDocument();
    });
  });

  it("renders requests list with request number, category, tier, status, and deliverables", async () => {
    const user = { id: "user-123", email: "fan@example.com" };
    const sampleRequest = {
      id: "req-1",
      request_number: "HLS-REQ-999999",
      tier: "Chunin",
      category: "Single Illustration",
      status: "in_progress",
      created_at: "2026-11-24T12:00:00.000Z",
      user_id: user.id,
      interview_question: null,
      action: "Dancing together",
      context: "At a festival",
      relation: "Friends",
      plot: "Celebration",
      story_briefing: null,
      credit_preference: "Credit my nickname",
      creative_freedom: "Balanced",
    };

    const sampleDeliverable = {
      id: "del-1",
      request_id: "req-1",
      storage_path: "req-1/final-artwork.png",
      original_filename: "final-artwork.png",
      mime_type: "image/png",
      byte_size: 2048576, // ~2MB
      created_at: "2026-11-24T12:30:00.000Z",
    };

    mockClient = createMockSupabaseClient({
      user,
      tableData: {
        requests: [sampleRequest],
        request_characters: [
          {
            request_id: "req-1",
            position: 0,
            character_name: "Tsunade",
            franchise: "Naruto",
            version_label: "Hokage",
          },
        ],
        request_references: [],
        request_deliverables: [sampleDeliverable],
        request_status_history: [
          { request_id: "req-1", status: "submitted", created_at: "2026-11-24T12:00:00.000Z" },
          { request_id: "req-1", status: "in_progress", created_at: "2026-11-24T12:15:00.000Z" },
        ],
        request_customer_updates: [
          {
            id: 1,
            request_id: "req-1",
            message: "Draft sketch is ready!",
            created_at: "2026-11-24T12:20:00.000Z",
          },
        ],
      },
    });

    render(<RequestHistory />);

    // Check request number and details
    expect(await screen.findByText(/HLS-REQ-999999/)).toBeInTheDocument();
    expect(screen.getByText(/Single Illustration/)).toBeInTheDocument();
    const inProgressElements = screen.getAllByText(/in progress/i);
    expect(inProgressElements.length).toBeGreaterThan(0);
    expect(screen.getByText(/Tsunade/)).toBeInTheDocument();
    expect(screen.getByText(/Draft sketch is ready!/)).toBeInTheDocument();

    // Check deliverable item
    expect(screen.getByText(/final-artwork.png/)).toBeInTheDocument();
    expect(screen.getByText(/2.0 MB/)).toBeInTheDocument();
    const downloadLink = screen.getByRole("link", { name: /download/i });
    expect(downloadLink).toBeInTheDocument();
    expect(downloadLink).toHaveAttribute("download", "final-artwork.png");
  });
});
