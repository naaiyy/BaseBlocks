import type { JsonObject, OpenEditorDocument } from "@openeditor/document";

/** Wire format used by snapshot-manifest fingerprints. */
export const OPENEDITOR_MANIFEST_FORMAT = "openeditor.site" as const;
export const OPENEDITOR_MANIFEST_VERSION = 1 as const;

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
