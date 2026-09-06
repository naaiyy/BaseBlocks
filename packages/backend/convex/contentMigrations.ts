import { migrateQuickLinksDocuments } from "@baseblocks/custom-blocks/migrations";
import { getConvexSize, v } from "convex/values";
import { internalMutation } from "./_generated/server";
import {
  extractOpenEditorReferences,
  extractOpenEditorText,
  hashOpenEditorContent,
  parseOpenEditorDocument,
} from "./pageContentFormat";

/** Explicit, idempotent storage migration; never called by document reads. */
export const quickLinksV2 = internalMutation({
  args: {
    payloadId: v.id("contentPayloads"),
    expectedHash: v.string(),
    apply: v.boolean(),
  },
  handler: async (ctx, { payloadId, expectedHash, apply }) => {
    const payload = await ctx.db.get(payloadId);
    if (!payload) throw new Error("Content payload does not exist.");
    const migrated = migrateQuickLinksDocuments(JSON.parse(payload.content));
    if (!migrated.changed) return { changed: false };
    if (payload.contentHash !== expectedHash)
      throw new Error("Content changed after the migration audit.");
    const document = parseOpenEditorDocument(migrated.document);
    const content = JSON.stringify(document);
    const contentHash = hashOpenEditorContent(content);
    const contentSize = getConvexSize(content);
    const revisions = await ctx.db
      .query("contentRevisions")
      .withIndex("by_payload", (q) => q.eq("payloadId", payloadId))
      .collect();
    if (!apply)
      return {
        changed: true,
        revisions: revisions.length,
        contentHash,
        contentSize,
      };
    const references = extractOpenEditorReferences(document);
    const libraryIds = [...references.libraryIds]
      .flatMap((id) => ctx.db.normalizeId("documentLibraries", id) ?? [])
      .sort();
    const fileIds = [...references.fileIds]
      .flatMap((id) => ctx.db.normalizeId("files", id) ?? [])
      .sort();
    const pageIds = [...references.pageIds]
      .flatMap((id) => ctx.db.normalizeId("pages", id) ?? [])
      .sort();
    const searchText = extractOpenEditorText(document);
    await ctx.db.patch(payloadId, { content, contentHash, contentSize });
    // Preserve revision identities, including released history. Update every denormalized hash.
    for (const revision of revisions) {
      await ctx.db.patch(revision._id, {
        contentHash,
        contentSize,
        searchText,
        libraryIds,
        fileIds,
        pageIds,
      });
      const drafts = await ctx.db
        .query("pageDocuments")
        .withIndex("by_revision", (q) => q.eq("revisionId", revision._id))
        .collect();
      for (const draft of drafts)
        await ctx.db.patch(draft._id, { contentHash, contentSize });
      const releases = await ctx.db
        .query("releasePages")
        .withIndex("by_content_revision", (q) =>
          q.eq("contentRevisionId", revision._id),
        )
        .collect();
      for (const release of releases)
        await ctx.db.patch(release._id, { contentHash });
    }
    const site = await ctx.db.get(payload.siteId);
    // The operator runs the existing storage reconciliation once per returned organization.
    return {
      changed: true,
      revisions: revisions.length,
      organizationId: site?.organizationId,
    };
  },
});
