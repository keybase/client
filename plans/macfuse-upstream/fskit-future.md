# Phase (b): our own FSKit module (future, not this branch)

Status: research only, no execution plan. Researched 2026-10-06; re-check every fact before starting.

## Idea

Ship a Swift FSKit extension inside the Keybase app. Users install nothing; they only enable the extension in System Settings. It replaces the stock-macFUSE path that this branch builds (D8).

The candidate design: the extension translates FSKit operations into FUSE protocol messages and sends them over a socket to the Go service. `keybase/fuse` serves FUSE over a file descriptor and a socket is one, so the Go side changes little and needs no cgo. macFUSE's own FSKit backend has the same shape (FSKit ↔ FUSE).

## Facts found (2026-10-06)

### Platform

- **Non-block filesystems need macOS 26+.**
  - FSKit shipped in 15.4 with `FSBlockDeviceResource` only. Apple DTS said network filesystems weren't supported then (forums thread 776322).
  - macOS 26 added [`FSPathURLResource`](https://developer.apple.com/documentation/fskit/fspathurlresource) and `FSGenericURLResource`. The latter is an opaque URL that may stand for a remote file system; the extension declares the schemes it handles with the `FSSupportedSchemes` Info.plist key.
- **Only `FSUnaryFileSystem` exists:** one resource, one volume.
- **macOS 27 adds two things.**
  - `FSClient.mountSingleVolume(resource:bundleID:options:)`, which needs the `com.apple.developer.fskit.mount` entitlement and mounts under `/Volumes/`.
  - Cache-coherency APIs such as `FSVolume.DataCacheHandler`.
- **Mounting.**
  - Mount with `mount -t <FSShortName> …` or `mount -F`. Apple's sample mounts outside `/Volumes`, but protected folders fail.
  - Before 27, DTS recommended the `mount` command over DiskArbitration.
- **User approval.** The user turns the extension on in System Settings → General → Login Items & Extensions → File System Extensions. `FSClient.openFileSystemExtensionsSettings()` opens that pane.
- **Entitlements and distribution.** The extension needs `com.apple.developer.fskit.fsmodule` and must be sandboxed. Developer ID builds may use sandbox exceptions, for example a Mach-lookup exception for XPC or a network-client entitlement for a socket.

### Known gaps for network filesystems

Reported by an SMB developer on macOS 27 (forums thread 842736):

- `fsync` and `sync` never reach the module.
- No byte-range locks and no ACLs.
- Negative-lookup cache pinning (fixed in 27.2).
- A stale data-cache race.
- A single failed activation wedges the resource until `fskitd` is killed.
- No way to report that items have xattrs, so a cold listing of 500 entries costs about 2,000 boundary crossings.

Caching is a trade-off. With `isDataCacheInhibited=true` there is no way to invalidate cached data; negotiated caching instead costs round trips on open and close (forums thread 849057).

Apple DTS: FSKit "isn't currently at a place where it can properly support a network file system."

### Performance

macFUSE's FSKit backend uses roughly 100–150% CPU, against about 40% for its kext backend. Every operation crosses kernel → fskitd → extension → daemon.

### Prior art

- Apple's PassthroughFS sample (uses the path resource).
- [fskit-rs / FSKitBridge](https://github.com/debox-network/fskit-rs): a Swift extension talking Protobuf over localhost TCP to a Rust engine.
- macFUSE 5.x with `-o backend=fskit`.
- ExtendFS and FSKitSample, both block-device based.
- Apple ships FAT, exFAT, and FTP as FSKit extensions in 26.

## Open questions to answer before planning

1. Does the minimum macOS version become 26, or 27 for `mountSingleVolume` and the cache APIs?
2. Transport: a localhost/Unix socket or XPC to a launchd Mach service? How does a sandboxed extension reach the Go service's socket?
3. Do we re-encode FSKit calls as FUSE messages (reusing the Go server), or define a narrower RPC?
4. Mount point: `/Volumes/Keybase` only? (The `/keybase` redirector is already gone on macOS under D25; the kext-mode mount point is D30.)
5. Can KBFS live with the gaps above, especially no `fsync` and the cache invalidation trade-off?
6. Spike first: a minimal read-only extension listing one KBFS folder, measured against kext-mode macFUSE throughput (D20 item 4 records the baseline).
