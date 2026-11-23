import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

type RequestSummary = {
  id: string;
  request_number: string;
  supporter_platform: string;
  supporter_nickname: string;
  contact_email: string;
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

type InternalNoteRecord = {
  id: number;
  request_id: string;
  note: string;
  created_at: string;
};

type PlanningRecord = { due_date: string | null; priority: string };
type EmailTemplateRecord = {
  template_key: "customer_request_received" | "owner_new_request";
  label: string;
  current_version_id: string | null;
};
type EmailTemplateVersion = {
  id: string;
  template_key: EmailTemplateRecord["template_key"];
  subject: string;
  html_body: string;
  is_default: boolean;
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

type RequestDetail = {
  characters: CharacterRecord[];
  references: ReferenceRecord[];
  deliverables: DeliverableRecord[];
  statusHistory: StatusRecord[];
  customerUpdates: CustomerUpdateRecord[];
  internalNotes: InternalNoteRecord[];
  planning: PlanningRecord | null;
};

function isOwner(appMetadata: Record<string, unknown> | undefined) {
  return appMetadata?.role === "owner";
}

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

function renderTemplatePreview(value: string) {
  const values: Record<string, string> = {
    request_number: "HLS-TEST-000001",
    supporter_nickname: "Test supporter",
    contact_email: "owner@example.test",
    tier: "Chunin",
    category: "Single Illustration",
  };
  return value.replace(/{{([a-z_]+)}}/g, (placeholder, key: string) => values[key] ?? placeholder);
}

const nextStatusesByCurrentStatus: Record<string, string[]> = {
  submitted: ["in_review", "cancelled"],
  in_review: ["accepted", "cancelled"],
  accepted: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
const emailTemplatePlaceholders = new Set([
  "request_number",
  "supporter_nickname",
  "contact_email",
  "tier",
  "category",
]);

export default function OwnerDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<RequestSummary | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(isSupabaseConfigured);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [customerUpdateMessage, setCustomerUpdateMessage] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [isSavingCustomerUpdate, setIsSavingCustomerUpdate] = useState(false);
  const [isSavingInternalNote, setIsSavingInternalNote] = useState(false);
  const [nextStatus, setNextStatus] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("normal");
  const [isSavingPlanning, setIsSavingPlanning] = useState(false);
  const [isUploadingDeliverable, setIsUploadingDeliverable] = useState(false);
  const [deliverableMessage, setDeliverableMessage] = useState("");
  const [page, setPage] = useState(0);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateRecord[]>([]);
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<
    EmailTemplateRecord["template_key"]
  >("customer_request_received");
  const [templateVersions, setTemplateVersions] = useState<EmailTemplateVersion[]>([]);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateHtml, setTemplateHtml] = useState("");
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSendingTemplateTest, setIsSendingTemplateTest] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");
  const pageSize = 20;

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let isCurrent = true;

    async function loadRequests() {
      setIsLoading(true);
      setErrorMessage("");
      const {
        data: { user: currentUser },
      } = await client.auth.getUser();
      if (!isCurrent) return;

      setUser(currentUser);
      if (!currentUser || !isOwner(currentUser.app_metadata)) {
        setRequests([]);
        setIsLoading(false);
        return;
      }

      const { data: templateData, error: templateError } = await client
        .from("email_templates")
        .select("template_key, label, current_version_id")
        .order("template_key");
      if (templateError) {
        setErrorMessage("Owner email templates could not be loaded. Please try again.");
      } else {
        const templates = (templateData ?? []) as EmailTemplateRecord[];
        setEmailTemplates(templates);
        const templateKey = templates[0]?.template_key;
        if (templateKey) {
          setSelectedTemplateKey(templateKey);
          void loadTemplateVersions(templateKey);
        }
      }

      const { data, error } = await client
        .from("requests")
        .select(
          "id, request_number, supporter_platform, supporter_nickname, contact_email, tier, category, status, created_at, interview_question, action, context, relation, plot, story_briefing, credit_preference, creative_freedom",
        )
        .order("created_at", { ascending: false });

      if (!isCurrent) return;
      if (error) {
        setErrorMessage("Owner requests could not be loaded. Please try again.");
        setRequests([]);
      } else {
        setRequests((data ?? []) as RequestSummary[]);
      }
      setIsLoading(false);
    }

    void loadRequests();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => void loadRequests());

    return () => {
      isCurrent = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadTemplateVersions(templateKey: EmailTemplateRecord["template_key"]) {
    if (!supabase) return;
    setIsLoadingTemplates(true);
    setTemplateMessage("");
    const [{ data: versions, error: versionsError }, { data: template }] = await Promise.all([
      supabase
        .from("email_template_versions")
        .select("id, template_key, subject, html_body, is_default, created_at")
        .eq("template_key", templateKey)
        .order("created_at", { ascending: false }),
      supabase
        .from("email_templates")
        .select("current_version_id")
        .eq("template_key", templateKey)
        .single(),
    ]);
    if (versionsError) {
      setErrorMessage("Email template versions could not be loaded. Please try again.");
      setIsLoadingTemplates(false);
      return;
    }
    const nextVersions = (versions ?? []) as EmailTemplateVersion[];
    const active = nextVersions.find((version) => version.id === template?.current_version_id);
    setTemplateVersions(nextVersions);
    setTemplateSubject(active?.subject ?? "");
    setTemplateHtml(active?.html_body ?? "");
    setIsLoadingTemplates(false);
  }

  const statuses = useMemo(
    () => Array.from(new Set(requests.map((request) => request.status))).sort(),
    [requests],
  );
  const visibleRequests = useMemo(() => {
    const query = searchTerm.trim().toLocaleLowerCase();
    return requests.filter((request) => {
      const matchesStatus = statusFilter === "all" || request.status === statusFilter;
      const matchesSearch =
        !query ||
        [
          request.request_number,
          request.supporter_nickname,
          request.supporter_platform,
          request.contact_email,
        ].some((value) => value.toLocaleLowerCase().includes(query));
      return matchesStatus && matchesSearch;
    });
  }, [requests, searchTerm, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(visibleRequests.length / pageSize));
  const pagedRequests = visibleRequests.slice(page * pageSize, (page + 1) * pageSize);

  function exportRequests() {
    const rows = visibleRequests.map((request) => [
      request.request_number,
      request.supporter_nickname,
      request.supporter_platform,
      request.contact_email,
      request.tier,
      request.category,
      request.status,
      request.created_at,
    ]);
    const csv = [
      [
        "Request number",
        "Supporter",
        "Platform",
        "Contact email",
        "Tier",
        "Category",
        "Status",
        "Submitted",
      ],
      ...rows,
    ]
      .map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "hidden-lewd-studio-requests.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function selectRequest(request: RequestSummary) {
    if (!supabase) return;
    const client = supabase;
    setSelectedRequest(request);
    setSelectedDetail(null);
    setNextStatus("");
    setIsDetailLoading(true);
    setErrorMessage("");

    const [
      charactersResult,
      referencesResult,
      deliverablesResult,
      historyResult,
      customerUpdatesResult,
      internalNotesResult,
      planningResult,
    ] = await Promise.all([
      client
        .from("request_characters")
        .select("request_id, position, character_name, franchise, version_label")
        .eq("request_id", request.id)
        .order("position", { ascending: true }),
      client
        .from("request_references")
        .select("request_id, storage_path, original_filename, mime_type, byte_size")
        .eq("request_id", request.id),
      client
        .from("request_deliverables")
        .select("id, request_id, storage_path, original_filename, mime_type, byte_size, created_at")
        .eq("request_id", request.id)
        .order("created_at", { ascending: false }),
      client
        .from("request_status_history")
        .select("request_id, status, created_at")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true }),
      client
        .from("request_customer_updates")
        .select("id, request_id, message, created_at")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true }),
      client
        .from("request_internal_notes")
        .select("id, request_id, note, created_at")
        .eq("request_id", request.id)
        .order("created_at", { ascending: true }),
      client
        .from("request_planning")
        .select("due_date, priority")
        .eq("request_id", request.id)
        .maybeSingle(),
    ]);

    if (
      charactersResult.error ||
      referencesResult.error ||
      deliverablesResult.error ||
      historyResult.error ||
      customerUpdatesResult.error ||
      internalNotesResult.error ||
      planningResult.error
    ) {
      setErrorMessage("Request details could not be loaded. Please try again.");
      setIsDetailLoading(false);
      return;
    }

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

    setSelectedDetail({
      characters: (charactersResult.data ?? []) as CharacterRecord[],
      references,
      deliverables,
      statusHistory: (historyResult.data ?? []) as StatusRecord[],
      customerUpdates: (customerUpdatesResult.data ?? []) as CustomerUpdateRecord[],
      internalNotes: (internalNotesResult.data ?? []) as InternalNoteRecord[],
      planning: planningResult.data as PlanningRecord | null,
    });
    setDueDate(planningResult.data?.due_date ?? "");
    setPriority(planningResult.data?.priority ?? "normal");
    setIsDetailLoading(false);
  }

  async function handleDeliverableUpload(event: React.ChangeEvent<HTMLInputElement>) {
    if (!supabase || !selectedRequest || !event.target.files?.length) return;
    const file = event.target.files[0];
    setIsUploadingDeliverable(true);
    setDeliverableMessage("");
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "bin";
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${extension}`;
    const storagePath = `${selectedRequest.id}/${uniqueName}`;

    const { error: uploadError } = await supabase.storage
      .from("request-deliverables")
      .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });

    if (uploadError) {
      setDeliverableMessage(`Upload failed: ${uploadError.message}`);
      setIsUploadingDeliverable(false);
      return;
    }

    const { error: insertError } = await supabase.from("request_deliverables").insert({
      request_id: selectedRequest.id,
      storage_path: storagePath,
      original_filename: file.name,
      mime_type: file.type || "application/octet-stream",
      byte_size: file.size,
      created_by: user?.id,
    });

    if (insertError) {
      await supabase.storage.from("request-deliverables").remove([storagePath]);
      setDeliverableMessage(`Failed to record deliverable: ${insertError.message}`);
      setIsUploadingDeliverable(false);
      return;
    }

    setDeliverableMessage("Deliverable uploaded successfully.");
    setIsUploadingDeliverable(false);
    event.target.value = "";
    await selectRequest(selectedRequest);
  }

  async function deleteDeliverable(deliverable: DeliverableRecord) {
    if (!supabase || !selectedRequest) return;
    if (!window.confirm(`Delete deliverable "${deliverable.original_filename}"?`)) return;
    setIsDetailLoading(true);
    await supabase.storage.from("request-deliverables").remove([deliverable.storage_path]);
    await supabase.from("request_deliverables").delete().eq("id", deliverable.id);
    await selectRequest(selectedRequest);
  }

  async function addCustomerUpdate() {
    if (!supabase || !user || !selectedRequest || !customerUpdateMessage.trim()) return;
    setIsSavingCustomerUpdate(true);
    setErrorMessage("");
    const { error } = await supabase.from("request_customer_updates").insert({
      request_id: selectedRequest.id,
      message: customerUpdateMessage.trim(),
      created_by: user.id,
    });
    setIsSavingCustomerUpdate(false);
    if (error) {
      setErrorMessage("The customer update could not be saved. Please try again.");
      return;
    }
    setCustomerUpdateMessage("");
    await selectRequest(selectedRequest);
  }

  async function changeStatus() {
    if (!supabase || !selectedRequest || !nextStatus) return;
    setIsSavingStatus(true);
    setErrorMessage("");
    const { data, error } = await supabase
      .from("requests")
      .update({ status: nextStatus })
      .eq("id", selectedRequest.id)
      .select("id");
    setIsSavingStatus(false);
    if (error || !data?.length) {
      setErrorMessage("The request status could not be changed. Please refresh and try again.");
      return;
    }

    const updatedRequest = { ...selectedRequest, status: nextStatus };
    setRequests((currentRequests) =>
      currentRequests.map((request) =>
        request.id === updatedRequest.id ? updatedRequest : request,
      ),
    );
    await selectRequest(updatedRequest);
  }

  async function savePlanning() {
    if (!supabase || !user || !selectedRequest) return;
    setIsSavingPlanning(true);
    const { error } = await supabase.from("request_planning").upsert({
      request_id: selectedRequest.id,
      due_date: dueDate || null,
      priority,
      updated_by: user.id,
    });
    setIsSavingPlanning(false);
    if (error) {
      setErrorMessage("Planning details could not be saved. Please try again.");
      return;
    }
    await selectRequest(selectedRequest);
  }

  function validateTemplatePlaceholders() {
    const placeholders = [
      ...templateSubject.matchAll(/{{([a-z_]+)}}/g),
      ...templateHtml.matchAll(/{{([a-z_]+)}}/g),
    ];
    return placeholders.every((match) => emailTemplatePlaceholders.has(match[1]));
  }

  async function saveEmailTemplate() {
    if (!supabase || !user || !templateSubject.trim() || !templateHtml.trim()) return;
    if (!validateTemplatePlaceholders()) {
      setTemplateMessage("Use only the documented placeholders below.");
      return;
    }
    setIsSavingTemplate(true);
    setTemplateMessage("");
    const { data: version, error: versionError } = await supabase
      .from("email_template_versions")
      .insert({
        template_key: selectedTemplateKey,
        subject: templateSubject.trim(),
        html_body: templateHtml.trim(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (versionError || !version) {
      setTemplateMessage("The template version could not be saved. Please try again.");
      setIsSavingTemplate(false);
      return;
    }
    const { error: activationError } = await supabase
      .from("email_templates")
      .update({ current_version_id: version.id })
      .eq("template_key", selectedTemplateKey);
    setIsSavingTemplate(false);
    if (activationError) {
      setTemplateMessage(
        "The version was saved but could not be activated. Please choose it from history.",
      );
      await loadTemplateVersions(selectedTemplateKey);
      return;
    }
    setTemplateMessage("New template version saved and activated.");
    await loadTemplateVersions(selectedTemplateKey);
  }

  async function activateTemplateVersion(versionId: string) {
    if (!supabase) return;
    const { error } = await supabase
      .from("email_templates")
      .update({ current_version_id: versionId })
      .eq("template_key", selectedTemplateKey);
    if (error) {
      setTemplateMessage("This version could not be activated. Please try again.");
      return;
    }
    setTemplateMessage("Template version activated.");
    await loadTemplateVersions(selectedTemplateKey);
  }

  async function sendTemplateTest() {
    if (!supabase) return;
    setIsSendingTemplateTest(true);
    setTemplateMessage("");
    const { error } = await supabase.functions.invoke("send-request-notifications", {
      body: { action: "test_template", templateKey: selectedTemplateKey },
    });
    setIsSendingTemplateTest(false);
    setTemplateMessage(
      error
        ? "The test email could not be sent. Check that hosted delivery is enabled."
        : "A test of the active template was sent only to your verified owner email.",
    );
  }

  async function addInternalNote() {
    if (!supabase || !user || !selectedRequest || !internalNote.trim()) return;
    setIsSavingInternalNote(true);
    setErrorMessage("");
    const { error } = await supabase.from("request_internal_notes").insert({
      request_id: selectedRequest.id,
      note: internalNote.trim(),
      created_by: user.id,
    });
    setIsSavingInternalNote(false);
    if (error) {
      setErrorMessage("The internal note could not be saved. Please try again.");
      return;
    }
    setInternalNote("");
    await selectRequest(selectedRequest);
  }

  if (!isSupabaseConfigured) {
    return <p className="history-message">Owner access is not configured yet.</p>;
  }

  if (isLoading) return <p className="history-message">Verifying owner access…</p>;

  if (!user || !isOwner(user.app_metadata)) {
    return <p className="history-message">This workspace is restricted to studio owners.</p>;
  }

  return (
    <>
      <section className="section-card history-intro">
        <div>
          <h2 className="section-header">Owner workspace</h2>
          <p className="field-hint">
            Review requests, manage customer updates and private notes, and keep production work
            planned.
          </p>
        </div>
        <p className="field-hint">{requests.length} total requests</p>
      </section>

      {errorMessage && <p className="error history-message">{errorMessage}</p>}

      <section className="section-card owner-controls" aria-label="Request filters">
        <label>
          Search requests
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Number, supporter, platform, or email"
          />
        </label>
        <label>
          Status
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {labelForStatus(status)}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn-outline"
          type="button"
          onClick={exportRequests}
          disabled={!visibleRequests.length}
        >
          Export filtered CSV
        </button>
      </section>

      <section className="section-card owner-email-templates">
        <div className="request-history-head">
          <div>
            <h2 className="section-header">Notification email templates</h2>
            <p className="field-hint">
              Versions are immutable. A test sends the active version only to your verified owner
              email.
            </p>
          </div>
        </div>
        {!emailTemplates.length ? (
          <p className="history-message">
            Email templates are unavailable until their migration is applied.
          </p>
        ) : (
          <>
            <label>
              Template
              <select
                value={selectedTemplateKey}
                onChange={(event) => {
                  const templateKey = event.target.value as EmailTemplateRecord["template_key"];
                  setSelectedTemplateKey(templateKey);
                  void loadTemplateVersions(templateKey);
                }}
              >
                {emailTemplates.map((template) => (
                  <option key={template.template_key} value={template.template_key}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>
            {isLoadingTemplates ? (
              <p className="history-message">Loading template versions…</p>
            ) : (
              <div className="owner-template-grid">
                <div>
                  <label className="owner-message-editor">
                    Subject
                    <input
                      value={templateSubject}
                      maxLength={200}
                      onChange={(event) => setTemplateSubject(event.target.value)}
                    />
                  </label>
                  <label className="owner-message-editor">
                    HTML body
                    <textarea
                      value={templateHtml}
                      maxLength={20000}
                      rows={12}
                      onChange={(event) => setTemplateHtml(event.target.value)}
                    />
                  </label>
                  <p className="field-hint">
                    Placeholders: {"{{request_number}}"}, {"{{supporter_nickname}}"},{" "}
                    {"{{contact_email}}"}, {"{{tier}}"}, {"{{category}}"}.
                  </p>
                  <div className="owner-status-editor">
                    <button
                      className="btn btn-cyan"
                      type="button"
                      disabled={isSavingTemplate || !templateSubject.trim() || !templateHtml.trim()}
                      onClick={() => void saveEmailTemplate()}
                    >
                      {isSavingTemplate ? "Saving…" : "Save and activate version"}
                    </button>
                    <button
                      className="btn btn-outline"
                      type="button"
                      disabled={isSendingTemplateTest}
                      onClick={() => void sendTemplateTest()}
                    >
                      {isSendingTemplateTest ? "Sending…" : "Send active-template test"}
                    </button>
                  </div>
                  {templateMessage && <p className="field-hint">{templateMessage}</p>}
                </div>
                <div>
                  <h3>Preview</h3>
                  <p className="field-hint">Subject: {renderTemplatePreview(templateSubject)}</p>
                  <iframe
                    className="email-template-preview"
                    sandbox=""
                    srcDoc={renderTemplatePreview(templateHtml)}
                    title="Email template preview"
                  />
                </div>
              </div>
            )}
            <section className="request-history-section">
              <h3>Version history</h3>
              <ol className="status-history-list">
                {templateVersions.map((version) => {
                  const active =
                    emailTemplates.find((template) => template.template_key === selectedTemplateKey)
                      ?.current_version_id === version.id;
                  return (
                    <li key={version.id}>
                      <strong>
                        {active ? "Active" : version.is_default ? "Default" : "Previous"}
                      </strong>{" "}
                      · {formatDate(version.created_at)} · {version.subject}
                      {!active && (
                        <button
                          className="btn btn-outline"
                          type="button"
                          onClick={() => void activateTemplateVersion(version.id)}
                        >
                          {version.is_default ? "Restore default" : "Activate"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          </>
        )}
      </section>

      <div className="owner-dashboard-layout">
        <section className="section-card owner-request-list" aria-label="Requests">
          <h2 className="section-header">Requests</h2>
          {!visibleRequests.length ? (
            <p className="history-message">No requests match these filters.</p>
          ) : (
            <ul>
              {pagedRequests.map((request) => (
                <li key={request.id}>
                  <button
                    className={`owner-request-button ${selectedRequest?.id === request.id ? "is-selected" : ""}`}
                    type="button"
                    onClick={() => void selectRequest(request)}
                  >
                    <span>
                      <strong>{request.request_number}</strong>
                      <small>
                        {request.supporter_nickname} · {request.tier} ·{" "}
                        {formatDate(request.created_at)}
                      </small>
                    </span>
                    <span className={`status-badge status-${request.status}`}>
                      {labelForStatus(request.status)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {visibleRequests.length > pageSize && (
            <div className="owner-status-editor">
              <button
                className="btn btn-outline"
                type="button"
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
              >
                Previous
              </button>
              <span className="field-hint">
                Page {page + 1} of {pageCount}
              </span>
              <button
                className="btn btn-outline"
                type="button"
                disabled={page + 1 >= pageCount}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          )}
        </section>

        <section className="section-card owner-request-detail" aria-live="polite">
          {!selectedRequest && (
            <p className="history-message">Select a request to review its details.</p>
          )}
          {selectedRequest && isDetailLoading && (
            <p className="history-message">Loading request details…</p>
          )}
          {selectedRequest && selectedDetail && (
            <>
              <div className="request-history-head">
                <div>
                  <h2>{selectedRequest.request_number}</h2>
                  <p>{formatDate(selectedRequest.created_at)}</p>
                </div>
                <span className={`status-badge status-${selectedRequest.status}`}>
                  {labelForStatus(selectedRequest.status)}
                </span>
              </div>
              <div className="owner-status-editor">
                <label>
                  Change status
                  <select
                    value={nextStatus}
                    onChange={(event) => setNextStatus(event.target.value)}
                  >
                    <option value="">Choose the next permitted status</option>
                    {(nextStatusesByCurrentStatus[selectedRequest.status] ?? []).map((status) => (
                      <option key={status} value={status}>
                        {labelForStatus(status)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="btn btn-cyan"
                  type="button"
                  disabled={isSavingStatus || !nextStatus}
                  onClick={() => void changeStatus()}
                >
                  {isSavingStatus ? "Updating…" : "Update status"}
                </button>
              </div>
              <div className="owner-status-editor">
                <label>
                  Due date
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
                <label>
                  Priority
                  <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={isSavingPlanning}
                  onClick={() => void savePlanning()}
                >
                  {isSavingPlanning ? "Saving…" : "Save planning"}
                </button>
              </div>
              <dl className="request-history-details">
                <div>
                  <dt>Supporter</dt>
                  <dd>{selectedRequest.supporter_nickname}</dd>
                </div>
                <div>
                  <dt>Platform</dt>
                  <dd>{selectedRequest.supporter_platform}</dd>
                </div>
                <div>
                  <dt>Contact email</dt>
                  <dd>{selectedRequest.contact_email}</dd>
                </div>
                <div>
                  <dt>Tier / category</dt>
                  <dd>
                    {selectedRequest.tier} · {selectedRequest.category}
                  </dd>
                </div>
                <div>
                  <dt>Credit</dt>
                  <dd>{selectedRequest.credit_preference}</dd>
                </div>
                <div>
                  <dt>Creative freedom</dt>
                  <dd>{selectedRequest.creative_freedom}</dd>
                </div>
              </dl>

              <section className="request-history-section">
                <h3>Cast</h3>
                <ul className="receipt-characters">
                  {selectedDetail.characters.map((character) => (
                    <li key={`${character.request_id}-${character.position}`}>
                      {character.character_name} · {character.franchise ?? "Custom"} ·{" "}
                      {character.version_label}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="request-history-section">
                <h3>Brief</h3>
                {selectedRequest.interview_question && (
                  <p>Question: {selectedRequest.interview_question}</p>
                )}
                {selectedRequest.action && <p>Action: {selectedRequest.action}</p>}
                {selectedRequest.context && <p>Setting: {selectedRequest.context}</p>}
                {selectedRequest.relation && <p>Relationship: {selectedRequest.relation}</p>}
                {selectedRequest.plot && <p>Plot: {selectedRequest.plot}</p>}
                {selectedRequest.story_briefing && (
                  <p>Story briefing: {selectedRequest.story_briefing}</p>
                )}
              </section>

              <section className="request-history-section">
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "0.5rem",
                  }}
                >
                  <h3 style={{ margin: 0 }}>Finished deliverables</h3>
                  <label className="btn btn-cyan btn-sm" style={{ cursor: "pointer" }}>
                    {isUploadingDeliverable ? "Uploading…" : "+ Upload Deliverable"}
                    <input
                      type="file"
                      disabled={isUploadingDeliverable}
                      style={{ display: "none" }}
                      onChange={handleDeliverableUpload}
                    />
                  </label>
                </div>
                {deliverableMessage && <p className="field-hint">{deliverableMessage}</p>}
                {selectedDetail.deliverables.length ? (
                  <ul className="reference-metadata-list">
                    {selectedDetail.deliverables.map((deliverable) => (
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
                        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                          {deliverable.signedUrl && (
                            <a
                              className="btn btn-outline btn-sm"
                              href={deliverable.signedUrl}
                              target="_blank"
                              rel="noreferrer"
                              download={deliverable.original_filename}
                            >
                              Download
                            </a>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            type="button"
                            onClick={() => deleteDeliverable(deliverable)}
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No deliverables uploaded yet for this request.</p>
                )}
              </section>

              <section className="request-history-section">
                <h3>Private reference images</h3>
                {selectedDetail.references.length ? (
                  <ul className="reference-metadata-list">
                    {selectedDetail.references.map((reference) => (
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
                  {selectedDetail.statusHistory.map((entry) => (
                    <li key={`${entry.request_id}-${entry.created_at}`}>
                      <strong>{labelForStatus(entry.status)}</strong> ·{" "}
                      {formatDate(entry.created_at)}
                    </li>
                  ))}
                </ol>
              </section>

              <section className="request-history-section">
                <h3>Customer-visible updates</h3>
                {selectedDetail.customerUpdates.length ? (
                  <ol className="status-history-list">
                    {selectedDetail.customerUpdates.map((update) => (
                      <li key={update.id}>
                        <strong>{formatDate(update.created_at)}</strong> · {update.message}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No customer-visible updates have been posted.</p>
                )}
                <label className="owner-message-editor">
                  New customer-visible update
                  <textarea
                    value={customerUpdateMessage}
                    onChange={(event) => setCustomerUpdateMessage(event.target.value)}
                    maxLength={5000}
                    rows={4}
                    placeholder="Write an update the customer can read in My requests."
                  />
                </label>
                <button
                  className="btn btn-cyan"
                  type="button"
                  disabled={isSavingCustomerUpdate || !customerUpdateMessage.trim()}
                  onClick={() => void addCustomerUpdate()}
                >
                  {isSavingCustomerUpdate ? "Posting…" : "Post customer update"}
                </button>
              </section>

              <section className="request-history-section">
                <h3>Internal notes</h3>
                <p>Visible only to owners. These notes never appear in the customer history.</p>
                {selectedDetail.internalNotes.length ? (
                  <ol className="status-history-list">
                    {selectedDetail.internalNotes.map((note) => (
                      <li key={note.id}>
                        <strong>{formatDate(note.created_at)}</strong> · {note.note}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>No internal notes have been added.</p>
                )}
                <label className="owner-message-editor">
                  New internal note
                  <textarea
                    value={internalNote}
                    onChange={(event) => setInternalNote(event.target.value)}
                    maxLength={10000}
                    rows={4}
                    placeholder="Write a private production note for owners."
                  />
                </label>
                <button
                  className="btn btn-pink"
                  type="button"
                  disabled={isSavingInternalNote || !internalNote.trim()}
                  onClick={() => void addInternalNote()}
                >
                  {isSavingInternalNote ? "Saving…" : "Save internal note"}
                </button>
              </section>
            </>
          )}
        </section>
      </div>
    </>
  );
}
