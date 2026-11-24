import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RequestForm from "../../src/components/RequestForm";
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
  setSessionPersistence: vi.fn(),
}));

describe("src/components/RequestForm.tsx", () => {
  const currentUser = {
    id: "user-123",
    email: "customer@example.com",
    app_metadata: {},
  };

  beforeEach(() => {
    mockIsConfigured = true;
    mockClient = createMockSupabaseClient({
      user: currentUser,
      tableData: {
        profiles: [
          {
            id: "user-123",
            last_supporter_nickname: "NarutoFan",
            last_supporter_platform: "Patreon",
          },
        ],
        requests: [],
      },
    });
  });

  it("renders supporter intake section, ranks, and categories", async () => {
    render(<RequestForm />);

    expect(screen.getByRole("heading", { name: /Request details/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Support platform/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Supporter nickname/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Shinobi Registration/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Request Category/i)).toBeInTheDocument();
  });

  it("prompts user to sign in if submitting while unauthenticated", async () => {
    mockClient = createMockSupabaseClient({ user: null });
    render(<RequestForm />);

    const submitBtn = screen.getByRole("button", { name: /Review request/i });
    fireEvent.submit(submitBtn.closest("form")!);

    await waitFor(() => {
      expect(
        screen.getByText(/Sign in from your email before reviewing and submitting this request/i),
      ).toBeInTheDocument();
    });
  });

  it("allows selecting Shinobi Rank and populates permitted categories", async () => {
    render(<RequestForm />);

    const tierSelect = screen.getByLabelText(/Shinobi Registration/i);
    fireEvent.change(tierSelect, { target: { value: "Chunin" } });

    const categorySelect = screen.getByLabelText(/Request Category/i);
    expect(categorySelect).not.toBeDisabled();

    // Select category "Single Illustration"
    fireEvent.change(categorySelect, { target: { value: "Single Illustration" } });

    // Scene details should now be visible
    expect(screen.getByLabelText(/Pose and action/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Setting and context/i)).toBeInTheDocument();
  });

  it("populates scene details when randomize button is clicked", async () => {
    render(<RequestForm />);

    const tierSelect = screen.getByLabelText(/Shinobi Registration/i);
    fireEvent.change(tierSelect, { target: { value: "Chunin" } });

    const categorySelect = screen.getByLabelText(/Request Category/i);
    fireEvent.change(categorySelect, { target: { value: "Single Illustration" } });

    const randomizeBtn = screen.getByRole("button", { name: /Randomize/i });
    fireEvent.click(randomizeBtn);

    const actionInput = screen.getByLabelText(/Pose and action/i) as HTMLInputElement;
    const contextInput = screen.getByLabelText(/Setting and context/i) as HTMLInputElement;

    expect(actionInput.value.length).toBeGreaterThan(0);
    expect(contextInput.value.length).toBeGreaterThan(0);
  });

  it("rejects reference upload with invalid MIME type", async () => {
    render(<RequestForm />);

    const fileInput = screen.getByLabelText(/Private reference images/i, { selector: "input" });
    const invalidFile = new File(["dummy content"], "notes.txt", { type: "text/plain" });

    fireEvent.change(fileInput, { target: { files: [invalidFile] } });

    await waitFor(() => {
      expect(
        screen.getByText(/References must be JPG, PNG, or WebP images no larger than 10 MB/i),
      ).toBeInTheDocument();
    });
  });

  it("completes request submission flow through review modal to confirmation", async () => {
    render(<RequestForm />);

    // Wait for user to be loaded
    expect(await screen.findByText(/Signed in as customer@example.com/i)).toBeInTheDocument();

    // 1. Select Rank
    const tierSelect = screen.getByLabelText(/Shinobi Registration/i);
    fireEvent.change(tierSelect, { target: { value: "Genin" } });

    // 2. Select Category (Genin only allows Interview)
    const categorySelect = screen.getByLabelText(/Request Category/i);
    fireEvent.change(categorySelect, { target: { value: "Interview" } });

    // 3. Select Platform & Nickname
    const platformSelect = screen.getByLabelText(/Support platform/i);
    fireEvent.change(platformSelect, { target: { value: "Patreon" } });

    const nicknameInput = screen.getByLabelText(/Supporter nickname/i);
    fireEvent.change(nicknameInput, { target: { value: "SakuraKun" } });

    // 4. Fill Question
    const questionInput = screen.getByLabelText(/Question or topic/i);
    fireEvent.change(questionInput, {
      target: { value: "What is your favorite ninja technique?" },
    });

    // 5. Confirm age and policy checkboxes
    const adultCheckbox = screen.getByLabelText(/I confirm that I am an adult/i);
    fireEvent.click(adultCheckbox);

    const policyCheckbox = screen.getByLabelText(/I have read and agree to the/i);
    fireEvent.click(policyCheckbox);

    // 6. Submit form
    const reviewBtn = screen.getByRole("button", { name: /Review request/i });
    fireEvent.submit(reviewBtn.closest("form")!);

    // Verify Review Modal opens
    expect(
      await screen.findByRole("heading", { name: /Review your request/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/SakuraKun/i)).toBeInTheDocument();

    // 7. Click Confirm request details
    const confirmBtn = screen.getByRole("button", { name: /Confirm request details/i });
    fireEvent.click(confirmBtn);

    // Verify Thank You Confirmation appears
    expect(
      await screen.findByRole("heading", { name: /Thank you for your support!/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Copy summary/i })).toBeInTheDocument();
  });
});
