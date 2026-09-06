import type { JsonObject, OpenEditorDocument } from "@openeditor/document";

export const OPENEDITOR_MUTATION_VERSION = 1 as const;

/** Retained for serialized mutation compatibility. */
export const OPENEDITOR_MUTATION_FORMAT =
  "openeditor.project-changeset" as const;

/** Retained for existing snapshot-manifest fingerprints. */
export const OPENEDITOR_MANIFEST_FORMAT = "openeditor.site" as const;

export type SnapshotPage = {
  id: string;
  title: string;
  document: OpenEditorDocument;
  slug?: string;
  route?: string;
  parentId?: string | null;
  order?: number;
  metadata?: JsonObject;
};

export type Snapshot = {
  id: string;
  revision: string;
  title: string;
  pages: readonly SnapshotPage[];
  metadata?: JsonObject;
};

export type CreatePageChange = {
  kind: "create";
  pageId: string;
  expectedFingerprint: null;
  nextFingerprint: string;
  next: SnapshotPage;
};

export type UpdatePageChange = {
  kind: "update";
  pageId: string;
  expectedFingerprint: string;
  nextFingerprint: string;
  next: SnapshotPage;
};

export type DeletePageChange = {
  kind: "delete";
  pageId: string;
  expectedFingerprint: string;
};

export type PageChange = CreatePageChange | UpdatePageChange | DeletePageChange;

export type Mutation = {
  format: typeof OPENEDITOR_MUTATION_FORMAT;
  version: typeof OPENEDITOR_MUTATION_VERSION;
  snapshotId: string;
  expectedRevision: string;
  expectedSnapshotFingerprint: string;
  expectedManifestFingerprint: string;
  nextManifestFingerprint: string;
  nextSnapshot: Snapshot;
  pageChanges: readonly PageChange[];
};

export type MutationConflictReason =
  | "snapshot_id_mismatch"
  | "snapshot_revision_mismatch"
  | "snapshot_fingerprint_mismatch"
  | "manifest_fingerprint_mismatch"
  | "page_fingerprint_mismatch"
  | "page_create_collision";

export type MutationApplyResult =
  | { applied: true; snapshot: Snapshot }
  | { applied: false; reason: MutationConflictReason; pageId?: string };

/**
 * The comparison and commit must occur in one database or storage
 * transaction. OpenEditor provides no non-atomic fallback.
 */
export interface TransactionalMutationStore {
  applyMutationAtomically(mutation: Mutation): Promise<MutationApplyResult>;
}

export type TransactionalMutationConformanceResult = {
  conformant: boolean;
  first: MutationApplyResult;
  replay: MutationApplyResult;
  failures: readonly string[];
};
