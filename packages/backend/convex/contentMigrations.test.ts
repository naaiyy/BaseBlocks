import { expect, test } from "bun:test";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { getConvexSize } from "convex/values";
import schema from "./schema";
import {
  hashOpenEditorContent,
  parseOpenEditorDocument,
} from "./pageContentFormat";

const modules = {
  "./_generated/api.ts": async () => ({}),
  "./contentMigrations.ts": () => import("./contentMigrations"),
};
const migration = makeFunctionReference<"mutation">(
  "contentMigrations:quickLinksV2",
);

test("content migration preserves revision identity, updates every hash, and is idempotent", async () => {
  const t = convexTest(schema, modules);
  const content = JSON.stringify({
    type: "doc",
    version: 1,
    content: [
      {
        type: "customBlock",
        attrs: {
          "openeditor-id": "quick-links-1",
          blockId: "baseblocks.quick-links",
          version: 1,
          data: {
            links: [
              {
                id: "link-1",
                title: "Example",
                url: "https://example.com",
                linkType: "website",
              },
            ],
          },
        },
      },
    ],
  });
  const contentHash = hashOpenEditorContent(content);
  const ids = await t.run(async (ctx) => {
    const siteId = await ctx.db.insert("sites", {
      organizationId: "org",
      name: "Site",
      slug: "site",
      createdBy: "user",
      createdAt: 1,
      updatedAt: 1,
      visibility: "private",
      settings: {},
      draftRevision: 1,
      nextReleaseNumber: 2,
    });
    const pageId = await ctx.db.insert("pages", {
      siteId,
      title: "Page",
      slug: "page",
      order: 0,
      createdBy: "user",
      createdAt: 1,
      updatedAt: 1,
    });
    const payloadId = await ctx.db.insert("contentPayloads", {
      siteId,
      content,
      contentHash,
      contentSize: getConvexSize(content),
      createdAt: 1,
    });
    const revisionId = await ctx.db.insert("contentRevisions", {
      siteId,
      payloadId,
      contentHash,
      contentSize: getConvexSize(content),
      searchText: "Example",
      libraryIds: [],
      fileIds: [],
      pageIds: [],
      createdAt: 1,
    });
    const draftId = await ctx.db.insert("pageDocuments", {
      siteId,
      pageId,
      revisionId,
      contentHash,
      contentSize: getConvexSize(content),
      updatedAt: 1,
    });
    const releaseId = await ctx.db.insert("siteReleases", {
      siteId,
      number: 1,
      name: "Release",
      settings: {},
      sourceDraftRevision: 1,
      createdBy: "user",
      createdAt: 1,
      pageCount: 1,
      changeCount: 1,
    });
    const releasePageId = await ctx.db.insert("releasePages", {
      siteId,
      releaseId,
      pageId,
      title: "Page",
      slug: "page",
      order: 0,
      contentRevisionId: revisionId,
      contentHash,
      description: "Example",
      updatedAt: 1,
    });
    return { payloadId, revisionId, draftId, releasePageId };
  });
  const args = {
    payloadId: ids.payloadId,
    expectedHash: contentHash,
    apply: false,
  };
  expect((await t.mutation(migration, args)).changed).toBe(true);
  expect((await t.run((ctx) => ctx.db.get(ids.payloadId)))?.content).toBe(
    content,
  );
  await expect(
    t.mutation(migration, { ...args, expectedHash: "stale", apply: true }),
  ).rejects.toThrow("changed after");
  expect((await t.mutation(migration, { ...args, apply: true })).changed).toBe(
    true,
  );
  await t.run(async (ctx) => {
    const payload = (await ctx.db.get(ids.payloadId))!;
    expect(payload.contentHash).toBe(hashOpenEditorContent(payload.content));
    expect(payload.contentSize).toBe(getConvexSize(payload.content));
    expect(
      parseOpenEditorDocument(payload.content).content[0]?.attrs?.version,
    ).toBe(2);
    expect((await ctx.db.get(ids.revisionId))?.contentHash).toBe(
      payload.contentHash,
    );
    expect((await ctx.db.get(ids.draftId))?.revisionId).toBe(ids.revisionId);
    expect((await ctx.db.get(ids.draftId))?.contentHash).toBe(
      payload.contentHash,
    );
    expect((await ctx.db.get(ids.releasePageId))?.contentRevisionId).toBe(
      ids.revisionId,
    );
    expect((await ctx.db.get(ids.releasePageId))?.contentHash).toBe(
      payload.contentHash,
    );
  });
  expect((await t.mutation(migration, { ...args, apply: true })).changed).toBe(
    false,
  );
});
