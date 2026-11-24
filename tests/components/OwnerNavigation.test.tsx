import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import OwnerNavigation from "../../src/components/OwnerNavigation";

let mockUser: any = null;
let mockIsConfigured = true;
const authListeners: ((event: string, session: any) => void)[] = [];

vi.mock("../../src/lib/supabase", () => ({
  get isSupabaseConfigured() {
    return mockIsConfigured;
  },
  supabase: {
    auth: {
      getUser: vi.fn().mockImplementation(async () => ({
        data: { user: mockUser },
        error: null,
      })),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        authListeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
  },
}));

describe("src/components/OwnerNavigation.tsx", () => {
  beforeEach(() => {
    mockUser = null;
    mockIsConfigured = true;
    authListeners.length = 0;
  });

  it("renders null when Supabase is not configured", async () => {
    mockIsConfigured = false;
    const { container } = render(<OwnerNavigation />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders null for anonymous user or non-owner user", async () => {
    mockUser = { id: "user-1", email: "customer@example.com", app_metadata: { role: "customer" } };
    const { container } = render(<OwnerNavigation />);

    // Wait for effect to run
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Owner workspace link when user has owner role in app_metadata", async () => {
    mockUser = { id: "owner-1", email: "owner@example.com", app_metadata: { role: "owner" } };
    render(<OwnerNavigation />);

    await act(async () => {});
    const link = screen.getByRole("link", { name: /owner workspace/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", expect.stringContaining("owner/"));
  });

  it("updates visibility when auth state change event fires", async () => {
    // Start with non-owner
    mockUser = null;
    const { container } = render(<OwnerNavigation />);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();

    // Sign in as owner
    mockUser = { id: "owner-1", email: "owner@example.com", app_metadata: { role: "owner" } };
    await act(async () => {
      authListeners.forEach((listener) => listener("SIGNED_IN", { user: mockUser }));
    });

    const link = screen.getByRole("link", { name: /owner workspace/i });
    expect(link).toBeInTheDocument();
  });
});
