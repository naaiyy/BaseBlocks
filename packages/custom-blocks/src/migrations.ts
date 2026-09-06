import { parseQuickLinksData } from "./quick-links";

/** Explicit application migration. Never runs implicitly while rendering or editing. */
export const migrateQuickLinksV1 = ({
  version,
  data,
}: {
  version: number;
  data: unknown;
}) => {
  const rawLinks =
    data && typeof data === "object"
      ? (data as { links?: unknown }).links
      : undefined;
  if (version !== 1 || !Array.isArray(rawLinks))
    throw new Error("Unsupported Quick Links version.");
  const links = rawLinks.flatMap((item: unknown) => {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      (item as Record<string, unknown>).linkType !== "website"
    )
      return [];
    const link = item as Record<string, unknown>;
    const artwork =
      link.artwork &&
      typeof link.artwork === "object" &&
      !Array.isArray(link.artwork)
        ? (link.artwork as Record<string, unknown>)
        : null;
    return [
      {
        id: link.id,
        title: link.title,
        url: link.url,
        ...(artwork?.kind === "asset" && typeof artwork.assetId === "string"
          ? { imageAssetId: artwork.assetId }
          : {}),
      },
    ];
  });
  return {
    blockId: "baseblocks.quick-links",
    version: 2,
    data: parseQuickLinksData({ links }),
  };
};

/** Converts persisted Quick Links envelopes, including those in nested documents. */
export function migrateQuickLinksDocuments<T>(source: T): {
  document: T;
  changed: boolean;
} {
  const document = structuredClone(source);
  let changed = false;
  const visit = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    const attrs = node.attrs as Record<string, unknown> | undefined;
    if (
      node.type === "customBlock" &&
      attrs?.blockId === "baseblocks.quick-links" &&
      attrs.version === 1
    ) {
      node.attrs = {
        ...attrs,
        ...migrateQuickLinksV1({ version: 1, data: attrs.data }),
      };
      changed = true;
    }
    Object.values(node).forEach(visit);
  };
  visit(document);
  return { document, changed };
}
