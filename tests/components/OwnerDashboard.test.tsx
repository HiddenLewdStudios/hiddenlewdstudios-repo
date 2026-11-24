import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import OwnerDashboard from "../../src/components/OwnerDashboard";
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

describe("src/components/OwnerDashboard.tsx", () => {
  beforeEach(() => {
    mockIsConfigured = true;
    mockClient = createMockSupabaseClient();
  });

  it("displays configuration message if Supabase is not configured", () => {
    mockIsConfigured = false;
    render(<OwnerDashboard />);
    expect(screen.getByText(/owner access is not configured yet/i)).toBeInTheDocument();
  });

  it("restricts access if user is not authenticated or not an owner", async () => {
    const customerUser = {
      id: "customer-1",
      email: "fan@example.com",
      app_metadata: { role: "customer" },
    };
    mockClient = createMockSupabaseClient({ user: customerUser });
    render(<OwnerDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText(/this workspace is restricted to studio owners/i),
      ).toBeInTheDocument();
    });
  });

  it("renders owner workspace and templates for an authenticated owner", async () => {
    const ownerUser = {
      id: "owner-1",
      email: "studio-owner@example.com",
      app_metadata: { role: "owner" },
    };

    const sampleRequests = [
      {
        id: "req-1",
        request_number: "HLS-REQ-100001",
        supporter_platform: "Patreon",
        supporter_nickname: "SakuraFan",
        contact_email: "sakura@example.com",
        tier: "Chunin",
        category: "Single Illustration",
        status: "submitted",
        created_at: "2026-11-24T12:00:00.000Z",
        interview_question: null,
        action: "Posing",
        context: "Studio",
        relation: null,
        plot: null,
        story_briefing: null,
        credit_preference: "Credit my nickname",
        creative_freedom: "Balanced",
      },
      {
        id: "req-2",
        request_number: "HLS-REQ-100002",
        supporter_platform: "Fanbox",
        supporter_nickname: "HinataLover",
        contact_email: "hinata@example.com",
        tier: "Jonin",
        category: "Comic",
        status: "in_progress",
        created_at: "2026-11-24T12:30:00.000Z",
        interview_question: null,
        action: "Training",
        context: "Dojo",
        relation: null,
        plot: null,
        story_briefing: null,
        credit_preference: "Anonymous",
        creative_freedom: "Full freedom",
      },
    ];

    const sampleTemplates = [
      {
        template_key: "customer_request_received",
        label: "Customer — Request received",
        current_version_id: "ver-1",
      },
      {
        template_key: "owner_new_request",
        label: "Owner — New request notification",
        current_version_id: "ver-2",
      },
    ];

    const sampleVersions = [
      {
        id: "ver-1",
        template_key: "customer_request_received",
        subject: "We received your request {{request_number}}",
        html_body: "<p>Thank you!</p>",
        is_default: true,
        created_at: "2026-11-24T10:00:00.000Z",
      },
    ];

    mockClient = createMockSupabaseClient({
      user: ownerUser,
      tableData: {
        email_templates: sampleTemplates,
        email_template_versions: sampleVersions,
        requests: sampleRequests,
        request_characters: [],
        request_references: [],
        request_deliverables: [],
        request_status_history: [],
        request_customer_updates: [],
        request_internal_notes: [],
        request_planning: [],
      },
    });

    render(<OwnerDashboard />);

    // Verify workspace header
    expect(await screen.findByRole("heading", { name: /owner workspace/i })).toBeInTheDocument();
    expect(screen.getByText(/2 total requests/i)).toBeInTheDocument();

    // Verify templates section
    expect(
      screen.getByRole("heading", { name: /notification email templates/i }),
    ).toBeInTheDocument();

    // Verify request items
    expect(screen.getByText("HLS-REQ-100001")).toBeInTheDocument();
    expect(screen.getByText("HLS-REQ-100002")).toBeInTheDocument();
  });

  it("filters requests when search term is entered", async () => {
    const ownerUser = {
      id: "owner-1",
      email: "studio-owner@example.com",
      app_metadata: { role: "owner" },
    };

    const sampleRequests = [
      {
        id: "req-1",
        request_number: "HLS-REQ-100001",
        supporter_platform: "Patreon",
        supporter_nickname: "SakuraFan",
        contact_email: "sakura@example.com",
        tier: "Chunin",
        category: "Single Illustration",
        status: "submitted",
        created_at: "2026-11-24T12:00:00.000Z",
      },
      {
        id: "req-2",
        request_number: "HLS-REQ-100002",
        supporter_platform: "Fanbox",
        supporter_nickname: "HinataLover",
        contact_email: "hinata@example.com",
        tier: "Jonin",
        category: "Comic",
        status: "in_progress",
        created_at: "2026-11-24T12:30:00.000Z",
      },
    ];

    mockClient = createMockSupabaseClient({
      user: ownerUser,
      tableData: {
        email_templates: [],
        requests: sampleRequests,
      },
    });

    render(<OwnerDashboard />);

    await screen.findByText("HLS-REQ-100001");
    expect(screen.getByText("HLS-REQ-100002")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/number, supporter, platform, or email/i);
    fireEvent.change(searchInput, { target: { value: "Sakura" } });

    expect(screen.getByText("HLS-REQ-100001")).toBeInTheDocument();
    expect(screen.queryByText("HLS-REQ-100002")).not.toBeInTheDocument();
  });

  it("selects a request and displays detail panel", async () => {
    const ownerUser = {
      id: "owner-1",
      email: "studio-owner@example.com",
      app_metadata: { role: "owner" },
    };

    const sampleRequest = {
      id: "req-1",
      request_number: "HLS-REQ-100001",
      supporter_platform: "Patreon",
      supporter_nickname: "SakuraFan",
      contact_email: "sakura@example.com",
      tier: "Chunin",
      category: "Single Illustration",
      status: "submitted",
      created_at: "2026-11-24T12:00:00.000Z",
      interview_question: null,
      action: "Posing",
      context: "Studio",
      relation: null,
      plot: null,
      story_briefing: null,
      credit_preference: "Credit my nickname",
      creative_freedom: "Balanced",
    };

    mockClient = createMockSupabaseClient({
      user: ownerUser,
      tableData: {
        email_templates: [],
        requests: [sampleRequest],
        request_characters: [],
        request_references: [],
        request_deliverables: [],
        request_status_history: [],
        request_customer_updates: [],
        request_internal_notes: [],
        request_planning: [],
      },
    });

    render(<OwnerDashboard />);

    await screen.findByText("HLS-REQ-100001");
    expect(screen.getByText(/select a request to review its details/i)).toBeInTheDocument();

    // Click request button to select it
    const reqButton = screen.getByRole("button", { name: /HLS-REQ-100001/i });
    fireEvent.click(reqButton);

    await waitFor(() => {
      expect(screen.queryByText(/select a request to review its details/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/change status/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/due date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/priority/i)).toBeInTheDocument();
    });
  });
});
