import { type SyntheticEvent, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type RequestRecord = {
  id: string;
  request_number: string;
  tier: string;
  category: string;
  status: string;
  created_at: string;
  interview_question: string | null;
  action: string | null;
  context: string | null;
  relation: string | null;
  plot: string | null;
  story_briefing: string | null;
  credit_preference: string;
  creative_freedom: string;
};

type CharacterRecord = {
  request_id: string;
  position: number;
  character_name: string;
  franchise: string | null;
  version_label: string;
};

type ReferenceRecord = {
  request_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  signedUrl: string | null;
};

type StatusRecord = {
  request_id: string;
  status: string;
  created_at: string;
};

type CustomerUpdateRecord = {
  id: number;
  request_id: string;
  message: string;
  created_at: string;
};

type DeliverableRecord = {
  id: string;
  request_id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  byte_size: number;
  created_at: string;
  signedUrl: string | null;
};

type RequestDetails = RequestRecord & {
  characters: CharacterRecord[];
  references: ReferenceRecord[];
  deliverables: DeliverableRecord[];
  statusHistory: StatusRecord[];
  customerUpdates: CustomerUpdateRecord[];
};

const baseUrl = import.meta.env.BASE_URL.endsWith("/")
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`;

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function labelForStatus(status: string) {
  return status.replaceAll("_", " ");
}

export default function RequestHistory() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<RequestDetails[]>([]);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [errorMessage, setErrorMessage] = useState("");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  useEffect(() => {
    if (!supabase) {
      return;
    }
    const client = supabase;

    async function loadRequests(currentUser: User | null) {
      setUser(currentUser);
      if (!currentUser) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage("");
      const { data: requestRows, error: requestError } = await client
        .from("requests")
        .select(
          "id, request_number, tier, category, status, created_at, interview_question, action, context, relation, plot, story_briefing, credit_preference, creative_freedom",
        )
        .order("created_at", { ascending: false });
      if (requestError) {
        setErrorMessage("Your request history could not be loaded. Please try again.");
        setIsLoading(false);
        return;
      }

      const rows = (requestRows ?? []) as RequestRecord[];
      if (!rows.length) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const requestIds = rows.map((request) => request.id);
      const [
        charactersResult,
        referencesResult,
        deliverablesResult,
        historyResult,
        customerUpdatesResult,
      ] = await Promise.all([
        client
          .from("request_characters")
          .select("request_id, position, character_name, franchise, version_label")
          .in("request_id", requestIds)
          .order("position", { ascending: true }),
        client
          .from("request_references")
          .select("request_id, storage_path, original_filename, mime_type, byte_size")
          .in("request_id", requestIds),
        client
          .from("request_deliverables")
          .select(
            "id, request_id, storage_path, original_filename, mime_type, byte_size, created_at",
          )
          .in("request_id", requestIds)
          .order("created_at", { ascending: false }),
        client
          .from("request_status_history")
          .select("request_id, status, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: true }),
        client
          .from("request_customer_updates")
          .select("id, request_id, message, created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: true }),
      ]);

      if (
        charactersResult.error ||
        referencesResult.error ||
        deliverablesResult.error ||
        historyResult.error ||
        customerUpdatesResult.error
      ) {
        setErrorMessage("Some request details could not be loaded. Please try again.");
        setIsLoading(false);
        return;
      }

      const characters = (charactersResult.data ?? []) as CharacterRecord[];
      const references = await Promise.all(
        ((referencesResult.data ?? []) as Omit<ReferenceRecord, "signedUrl">[]).map(
          async (reference) => {
            const { data } = await client.storage
              .from("request-references")
              .createSignedUrl(reference.storage_path, 60 * 60);
            return { ...reference, signedUrl: data?.signedUrl ?? null };
          },
        ),
      );
      const deliverables = await Promise.all(
        ((deliverablesResult.data ?? []) as Omit<DeliverableRecord, "signedUrl">[]).map(
          async (deliverable) => {
            const { data } = await client.storage
              .from("request-deliverables")
              .createSignedUrl(deliverable.storage_path, 60 * 60);
            return { ...deliverable, signedUrl: data?.signedUrl ?? null };
          },
        ),
      );
      const history = (historyResult.data ?? []) as StatusRecord[];
      const customerUpdates = (customerUpdatesResult.data ?? []) as CustomerUpdateRecord[];
      setRequests(
        rows.map((request) => ({
          ...request,
          characters: characters.filter((character) => character.request_id === request.id),
          references: references.filter((reference) => reference.request_id === request.id),
          deliverables: deliverables.filter((deliverable) => deliverable.request_id === request.id),
          statusHistory: history.filter((entry) => entry.request_id === request.id),
          customerUpdates: customerUpdates.filter((entry) => entry.request_id === request.id),
        })),
      );
      setIsLoading(false);
    }

    void client.auth.getUser().then(({ data }) => loadRequests(data.user));
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => loadRequests(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  if (!isSupabaseConfigured) {
    return <p className="history-message">Request history is not configured yet.</p>;
  }

  function authRedirectUrl() {
    return new URL(`${baseUrl}requests/`, window.location.origin).toString();
  }

  async function signInWithPassword(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setIsAuthenticating(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: authEmail.trim(),
      password: authPassword,
    });
    setIsAuthenticating(false);
    if (error) setAuthMessage(error.message);
    else setIsAuthModalOpen(false);
  }

  async function sendMagicLink() {
    if (!supabase || !authEmail.trim()) {
      setAuthMessage("Enter your email address first.");
      return;
    }
    setIsAuthenticating(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: authEmail.trim(),
      options: { emailRedirectTo: authRedirectUrl(), shouldCreateUser: false },
    });
    setIsAuthenticating(false);
    setAuthMessage(error ? error.message : "Check your email for a secure sign-in link.");
  }

  if (isLoading) return <p className="history-message">Loading your request history…</p>;

  if (!user) {
    return (
      <>
        <section className="section-card history-message">
          <h2 className="section-header">🔐 Sign in to view requests</h2>
          <p>Your request history is visible only to the account that created it.</p>
          <button className="btn btn-cyan" type="button" onClick={() => setIsAuthModalOpen(true)}>
            Sign in
          </button>
        </section>
        {isAuthModalOpen && (
          <div className="modal-backdrop">
            <section className="modal auth-modal" aria-modal="true" role="dialog">
              <button
                className="modal-close"
                type="button"
                onClick={() => setIsAuthModalOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
              <h2>Sign in</h2>
              <form className="auth-form" onSubmit={signInWithPassword}>
                <label>
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    onChange={(event) => setAuthEmail(event.target.value)}
                    required
                  />
                </label>
                <label>
                  Password
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={authPassword}
                    onChange={(event) => setAuthPassword(event.target.value)}
                    required
                  />
                </label>
                <button className="btn btn-pink" type="submit" disabled={isAuthenticating}>
                  Sign in
                </button>
              </form>
              <div className="auth-alternatives">
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={isAuthenticating}
                  onClick={sendMagicLink}
                >
                  Email me a sign-in link
                </button>
              </div>
              {authMessage && (
                <p className="field-hint" role="status">
                  {authMessage}
                </p>
              )}
              <p className="field-hint">
                Need an account? <a href={baseUrl}>Create one from the request page.</a>
              </p>
            </section>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <section className="section-card history-intro">
        <h2 className="section-header">📋 My requests</h2>
        <p className="field-hint">Signed in as {user.email}</p>
        <a className="btn btn-outline" href={baseUrl}>
          Create a new request
        </a>
      </section>

      {errorMessage && <p className="error history-message">{errorMessage}</p>}
      {!errorMessage && !requests.length && (
        <section className="section-card history-message">
          <h2>No requests yet</h2>
          <p>Requests you submit while signed in to this account will appear here.</p>
        </section>
      )}

      <div className="request-history-list">
        {requests.map((request) => (
          <article className="section-card request-history-card" key={request.id}>
            <div className="request-history-head">
              <div>
                <h2>{request.request_number}</h2>
                <p>{formatDate(request.created_at)}</p>
              </div>
              <span className={`status-badge status-${request.status}`}>
                {labelForStatus(request.status)}
              </span>
            </div>
            <dl className="request-history-details">
              <div>
                <dt>Tier</dt>
                <dd>{request.tier}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{request.category}</dd>
              </div>
              <div>
                <dt>Credit</dt>
                <dd>{request.credit_preference}</dd>
              </div>
              <div>
                <dt>Creative freedom</dt>
                <dd>{request.creative_freedom}</dd>
              </div>
            </dl>

            <section className="request-history-section">
              <h3>Cast</h3>
              <ul className="receipt-characters">
                {request.characters.map((character) => (
                  <li key={`${character.request_id}-${character.position}`}>
                    {character.character_name} · {character.franchise ?? "Custom"} ·{" "}
                    {character.version_label}
                  </li>
                ))}
              </ul>
            </section>

            <section className="request-history-section">
              <h3>Brief</h3>
              {request.interview_question ? <p>Question: {request.interview_question}</p> : null}
              {request.action ? <p>Action: {request.action}</p> : null}
              {request.context ? <p>Setting: {request.context}</p> : null}
              {request.relation ? <p>Relationship: {request.relation}</p> : null}
              {request.plot ? <p>Plot: {request.plot}</p> : null}
              {request.story_briefing ? <p>Story briefing: {request.story_briefing}</p> : null}
            </section>

            <section className="request-history-section">
              <h3>Finished deliverables</h3>
              {request.deliverables.length ? (
                <ul className="reference-metadata-list">
                  {request.deliverables.map((deliverable) => (
                    <li key={deliverable.id} className="deliverable-card">
                      {deliverable.signedUrl && deliverable.mime_type.startsWith("image/") && (
                        <img
                          className="reference-preview"
                          src={deliverable.signedUrl}
                          alt={deliverable.original_filename}
                        />
                      )}
                      <span>
                        <strong>{deliverable.original_filename}</strong> ·{" "}
                        {formatBytes(deliverable.byte_size)}
                      </span>
                      {deliverable.signedUrl && (
                        <div>
                          <a
                            className="btn btn-cyan btn-sm"
                            href={deliverable.signedUrl}
                            target="_blank"
                            rel="noreferrer"
                            download={deliverable.original_filename}
                          >
                            Download
                          </a>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint">
                  {request.status === "completed"
                    ? "Your request is completed. Deliverables will be available shortly."
                    : "Deliverable files will appear here for download once the commission is completed."}
                </p>
              )}
            </section>

            <section className="request-history-section">
              <h3>Reference images</h3>
              {request.references.length ? (
                <ul className="reference-metadata-list">
                  {request.references.map((reference) => (
                    <li key={reference.storage_path}>
                      {reference.signedUrl && (
                        <img
                          className="reference-preview"
                          src={reference.signedUrl}
                          alt={reference.original_filename}
                        />
                      )}
                      <span>
                        {reference.original_filename} ·{" "}
                        {reference.mime_type.replace("image/", "").toUpperCase()} ·{" "}
                        {formatBytes(reference.byte_size)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No reference images were included.</p>
              )}
            </section>

            <section className="request-history-section">
              <h3>Status history</h3>
              <ol className="status-history-list">
                {request.statusHistory.map((entry) => (
                  <li key={`${entry.request_id}-${entry.created_at}`}>
                    <strong>{labelForStatus(entry.status)}</strong> · {formatDate(entry.created_at)}
                  </li>
                ))}
              </ol>
            </section>

            <section className="request-history-section">
              <h3>Updates from the studio</h3>
              {request.customerUpdates.length ? (
                <ol className="status-history-list">
                  {request.customerUpdates.map((update) => (
                    <li key={update.id}>
                      <strong>{formatDate(update.created_at)}</strong> · {update.message}
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No studio updates have been posted yet.</p>
              )}
            </section>
          </article>
        ))}
      </div>
    </>
  );
}
