import { vi } from "vitest";

export interface MockSupabaseOptions {
  user?: {
    id: string;
    email?: string;
    app_metadata?: Record<string, unknown>;
    user_metadata?: Record<string, unknown>;
  } | null;
  tableData?: Record<string, any[]>;
  storageData?: Record<string, any>;
  functionResponses?: Record<string, any>;
}

export function createMockSupabaseClient(options: MockSupabaseOptions = {}) {
  const currentUser = options.user === undefined ? null : options.user;
  const tableData: Record<string, any[]> = options.tableData || {};

  const queryBuilder = (tableName: string) => {
    let currentData = [...(tableData[tableName] || [])];
    let isSingle = false;
    let isMaybeSingle = false;

    const builder: any = {
      select: vi.fn().mockImplementation((_columns?: string) => {
        return builder;
      }),
      insert: vi.fn().mockImplementation((rows: any) => {
        const rawArray = Array.isArray(rows) ? rows : [rows];
        const rowArray = rawArray.map((row, idx) => ({
          id: row.id || `mock-${tableName}-id-${idx + 1}`,
          ...(tableName === "requests"
            ? { request_number: row.request_number || "HLS-REQ-123456" }
            : {}),
          ...row,
        }));
        tableData[tableName] = [...(tableData[tableName] || []), ...rowArray];
        currentData = rowArray;
        return builder;
      }),
      upsert: vi.fn().mockImplementation((rows: any) => {
        const rawArray = Array.isArray(rows) ? rows : [rows];
        const rowArray = rawArray.map((row, idx) => ({
          id: row.id || `mock-${tableName}-id-${idx + 1}`,
          ...row,
        }));
        tableData[tableName] = [...(tableData[tableName] || []), ...rowArray];
        currentData = rowArray;
        return builder;
      }),
      update: vi.fn().mockImplementation((values: any) => {
        currentData = currentData.map((item) => ({ ...item, ...values }));
        return builder;
      }),
      delete: vi.fn().mockImplementation(() => {
        return builder;
      }),
      eq: vi.fn().mockImplementation((column: string, value: any) => {
        currentData = currentData.filter((item) => item[column] === value);
        return builder;
      }),
      neq: vi.fn().mockImplementation((column: string, value: any) => {
        currentData = currentData.filter((item) => item[column] !== value);
        return builder;
      }),
      in: vi.fn().mockImplementation((column: string, values: any[]) => {
        currentData = currentData.filter((item) => values.includes(item[column]));
        return builder;
      }),
      order: vi.fn().mockImplementation(() => builder),
      range: vi.fn().mockImplementation((from: number, to: number) => {
        currentData = currentData.slice(from, to + 1);
        return builder;
      }),
      single: vi.fn().mockImplementation(() => {
        isSingle = true;
        return builder;
      }),
      maybeSingle: vi.fn().mockImplementation(() => {
        isMaybeSingle = true;
        return builder;
      }),
      then: (resolve: (val: any) => void, reject?: (err: any) => void) => {
        let result: any = currentData;
        if (isSingle) {
          result = currentData[0] || null;
          if (!result) {
            return Promise.resolve({ data: null, error: new Error("Row not found") }).then(
              resolve,
              reject,
            );
          }
        } else if (isMaybeSingle) {
          result = currentData[0] || null;
        }
        return Promise.resolve({ data: result, error: null }).then(resolve, reject);
      },
    };

    return builder;
  };

  const authStateListeners: ((event: string, session: any) => void)[] = [];

  const mockClient = {
    auth: {
      getUser: vi.fn().mockImplementation(async () => {
        return {
          data: { user: currentUser },
          error: null,
        };
      }),
      getSession: vi.fn().mockImplementation(async () => {
        return {
          data: {
            session: currentUser ? { user: currentUser, access_token: "mock-token" } : null,
          },
          error: null,
        };
      }),
      signInWithPassword: vi.fn().mockImplementation(async ({ email, password }) => {
        if (!email || !password) {
          return { data: { user: null, session: null }, error: new Error("Invalid credentials") };
        }
        return {
          data: {
            user: { id: "mock-user-id", email, app_metadata: {} },
            session: { access_token: "mock-token" },
          },
          error: null,
        };
      }),
      signInWithOtp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithOAuth: vi
        .fn()
        .mockResolvedValue({ data: { provider: "google", url: "https://auth.mock" }, error: null }),
      signUp: vi.fn().mockResolvedValue({
        data: { user: { id: "new-user-id", email: "new@example.com" } },
        error: null,
      }),
      signOut: vi.fn().mockImplementation(async () => {
        authStateListeners.forEach((listener) => listener("SIGNED_OUT", null));
        return { error: null };
      }),
      onAuthStateChange: vi.fn().mockImplementation((callback) => {
        authStateListeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
    },
    from: vi.fn().mockImplementation((table: string) => queryBuilder(table)),
    storage: {
      from: vi.fn().mockImplementation((bucket: string) => ({
        upload: vi.fn().mockResolvedValue({ data: { path: `mock/${Date.now()}` }, error: null }),
        createSignedUrl: vi.fn().mockImplementation(async (path: string) => ({
          data: { signedUrl: `https://mock-storage.test/${bucket}/${path}?token=mock-token` },
          error: null,
        })),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    functions: {
      invoke: vi.fn().mockImplementation(async (fnName: string, options: any) => {
        const responseData = options?.functionResponses?.[fnName] ?? { success: true };
        return { data: responseData, error: null };
      }),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  };

  return mockClient;
}
