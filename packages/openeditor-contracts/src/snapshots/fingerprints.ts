import {
  canonicalSerializeJson,
  fingerprintOpenEditorDocument,
  type JsonValue,
} from "@openeditor/document";
import {
  OPENEDITOR_MANIFEST_FORMAT,
  OPENEDITOR_MUTATION_VERSION,
  type Snapshot,
  type SnapshotPage,
} from "./types";

const textEncoder = new TextEncoder();

const fingerprintJson = async (value: unknown): Promise<string> => {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.subtle) {
    throw new Error(
      "Web Crypto SHA-256 support is required to fingerprint OpenEditor data.",
    );
  }
  const digest = await cryptoApi.subtle.digest(
    "SHA-256",
    textEncoder.encode(`${canonicalSerializeJson(value)}\n`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const pagePath = (pageId: string): string => `pages/${pageId}.json`;

const manifestPageValue = (page: SnapshotPage): JsonValue => ({
  id: page.id,
  file: pagePath(page.id),
  title: page.title,
  ...(page.slug !== undefined ? { slug: page.slug } : {}),
  ...(page.route !== undefined ? { route: page.route } : {}),
  ...(page.parentId !== undefined ? { parentId: page.parentId } : {}),
  ...(page.order !== undefined ? { order: page.order } : {}),
  ...(page.metadata !== undefined ? { metadata: page.metadata } : {}),
});

/**
 * Builds the established `openeditor.site` value without exposing its legacy
 * vocabulary as TypeScript contracts.
 */
export const createSnapshotManifest = (snapshot: Snapshot): JsonValue => ({
  format: OPENEDITOR_MANIFEST_FORMAT,
  version: OPENEDITOR_MUTATION_VERSION,
  project: {
    id: snapshot.id,
    revision: snapshot.revision,
    title: snapshot.title,
    ...(snapshot.metadata !== undefined ? { metadata: snapshot.metadata } : {}),
  },
  pages: snapshot.pages.map(manifestPageValue),
});

export const fingerprintSnapshotPage = async (
  page: SnapshotPage,
): Promise<string> => {
  const documentFingerprint = fingerprintOpenEditorDocument(page.document);
  const metadataFingerprint = await fingerprintJson(manifestPageValue(page));
  return `oep1-${documentFingerprint}-${metadataFingerprint}`;
};

export const fingerprintSnapshot = async (
  snapshot: Snapshot,
): Promise<string> => fingerprintJson(snapshot);

export const fingerprintSnapshotManifest = async (
  snapshot: Snapshot,
): Promise<string> => fingerprintJson(createSnapshotManifest(snapshot));
