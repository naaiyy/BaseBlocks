import {
  fingerprintSnapshot,
  fingerprintSnapshotManifest,
  type Snapshot,
} from "@baseblocks/openeditor-contracts/snapshots";

export async function fingerprintAiProjectTrustRoot(project: Snapshot) {
  return {
    projectFingerprint: await fingerprintSnapshot(project),
    siteFingerprint: await fingerprintSnapshotManifest(project),
  };
}
