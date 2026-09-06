import {
  fingerprintSnapshot,
  fingerprintSnapshotManifest,
  fingerprintSnapshotPage,
} from "./fingerprints";
import type {
  Mutation,
  MutationApplyResult,
  Snapshot,
  TransactionalMutationConformanceResult,
  TransactionalMutationStore,
} from "./types";

/** Delegates only to a provider that explicitly guarantees atomic CAS. */
export const applyMutation = (
  store: TransactionalMutationStore,
  mutation: Mutation,
): Promise<MutationApplyResult> => store.applyMutationAtomically(mutation);

/**
 * Pure precondition helper for use inside a provider transaction. Calling it
 * before a later write does not make that write atomic.
 */
export const checkMutationPreconditions = async (
  current: Snapshot,
  mutation: Mutation,
): Promise<MutationApplyResult> => {
  if (current.id !== mutation.snapshotId) {
    return { applied: false, reason: "snapshot_id_mismatch" };
  }
  if (current.revision !== mutation.expectedRevision) {
    return { applied: false, reason: "snapshot_revision_mismatch" };
  }
  if (
    (await fingerprintSnapshot(current)) !==
    mutation.expectedSnapshotFingerprint
  ) {
    return { applied: false, reason: "snapshot_fingerprint_mismatch" };
  }
  if (
    (await fingerprintSnapshotManifest(current)) !==
    mutation.expectedManifestFingerprint
  ) {
    return { applied: false, reason: "manifest_fingerprint_mismatch" };
  }

  const pages = new Map(current.pages.map((page) => [page.id, page]));
  for (const change of mutation.pageChanges) {
    const page = pages.get(change.pageId);
    if (change.kind === "create") {
      if (page) {
        return {
          applied: false,
          reason: "page_create_collision",
          pageId: change.pageId,
        };
      }
      continue;
    }
    if (
      !page ||
      (await fingerprintSnapshotPage(page)) !== change.expectedFingerprint
    ) {
      return {
        applied: false,
        reason: "page_fingerprint_mismatch",
        pageId: change.pageId,
      };
    }
  }

  return { applied: true, snapshot: structuredClone(mutation.nextSnapshot) };
};

/**
 * Minimal destructive conformance exercise for a disposable provider fixture:
 * the first CAS must commit and an identical replay must be rejected.
 */
export const runTransactionalMutationStoreConformance = async (
  store: TransactionalMutationStore,
  mutation: Mutation,
): Promise<TransactionalMutationConformanceResult> => {
  const first = await store.applyMutationAtomically(mutation);
  const replay = await store.applyMutationAtomically(mutation);
  const failures = [
    ...(!first.applied ? ["A valid first mutation was rejected."] : []),
    ...(replay.applied
      ? ["An already-applied mutation was accepted again."]
      : []),
  ];
  return { conformant: failures.length === 0, first, replay, failures };
};
