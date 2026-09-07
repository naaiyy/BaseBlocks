import assert from "node:assert/strict";
import test from "node:test";

import {
  createSnapshotManifest,
  fingerprintSnapshot,
  fingerprintSnapshotManifest,
  fingerprintSnapshotPage,
  pagePath,
} from "./index";

const makePage = (title = "Home") => ({
  id: "home",
  title,
  route: "/",
  order: 0,
  document: {
    type: "doc" as const,
    version: 1 as const,
    meta: { id: "home", title },
    content: [
      {
        type: "heading",
        attrs: { level: 1, "openeditor-id": "oe_heading_home" },
        content: [{ type: "text", text: title }],
      },
      {
        type: "paragraph",
        attrs: { "openeditor-id": "oe_paragraph_home" },
        content: [{ type: "text", text: "Welcome" }],
      },
    ],
  },
});

const makeSnapshot = () => ({
  id: "site_alpha",
  revision: "revision_7",
  title: "Documentation",
  metadata: { locale: "en" },
  pages: [makePage()],
});

test("fingerprints preserve the established manifest and page wire values", async () => {
  const snapshot = makeSnapshot();

  assert.equal(pagePath("home"), "pages/home.json");
  assert.deepEqual(createSnapshotManifest(snapshot), {
    format: "openeditor.site",
    version: 1,
    project: {
      id: "site_alpha",
      revision: "revision_7",
      title: "Documentation",
      metadata: { locale: "en" },
    },
    pages: [
      {
        id: "home",
        file: "pages/home.json",
        title: "Home",
        route: "/",
        order: 0,
      },
    ],
  });
  assert.equal(
    await fingerprintSnapshotPage(snapshot.pages[0]),
    "oep1-oe1-fnv1a64-497bb41406b875c1-7f26c0d6cd9efd2b28be9ddb31b7903a3c6e8f853544586a2556f17822bafe3a",
  );
  assert.equal(
    await fingerprintSnapshot(snapshot),
    "775a5051f1db9114c70a494e7d0a585f548ad830d04b933a6e31a7f2fcfa15eb",
  );
  assert.equal(
    await fingerprintSnapshotManifest(snapshot),
    "59e0d22546cbb233fab3b536449f13176a87cb9f3758ee51a62baa6ca8043b7b",
  );
});
