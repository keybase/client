# Unified asset trim + compression (share extension and in-chat)

Date: 2026-07-28
Status: approved, ready for implementation plan

## Problem

Attaching a video in chat and sharing a video into Keybase from another app take
two different code paths that compress differently, so the same source clip
produces different uploads depending on how it was sent.

- In-chat picks are compressed by iOS itself, via the `videoExportPreset` /
  `videoQuality` options passed to `expo-image-picker`
  (`shared/util/expo-image-picker.tsx`). Trimming exists only as a side effect of
  forcing `allowsEditing: true`, which also forces single-select.
- Share-extension items are compressed in the extension by
  `MediaUtils.processVideo` (`rnmodules/kb-common/src/ItemProviderHelper.swift:193`),
  under different rules, with no trim UI at all.

The immediate user-visible symptom was an upload-size regression relative to
v6.6.0 (fixed as a stopgap in PR #29485), but the underlying issue is that there
are two compression policies.

## Goal

The share extension and in-chat attach are functionally equivalent for assets.
A given source video produces identical bytes either way, given the same trim
and the same compression setting. Changing the compression policy in one place
changes it for both.

Trim is iOS-only. Android keeps its existing flow.

## Design

### Convergence point

Both flows already navigate to `chatAttachmentGetTitles`
(`shared/chat/conversation/attachment-get-titles.tsx`), from
`shared/chat/conversation/input-area/normal/input.tsx:1112` and
`shared/incoming-share/index.tsx:191`. It receives plain file paths. It becomes
the single place where trim and compression happen, for both flows.

### Compression policy

`MediaUtils.determineOptimalExportSettings`
(`rnmodules/kb-common/src/MediaUtils.swift:178-199`) currently branches on
source size: over 1920x1080 or over 50MB exports `MediumQuality`, everything
else Passthrough. That branch is removed. The caller states intent instead, and
there are exactly three outcomes:

| don't-compress setting | trimmed | result |
| --- | --- | --- |
| off | either | `MediumQuality` export |
| on | no | Passthrough — byte-identical original |
| on | yes | one high-quality export (the trim's own encode) |

`MediaProcessingConfig` (`MediaUtils.swift:6-10`) remains the single knob for
both flows.

Rationale for the trimmed + don't-compress case: `UIVideoEditorController`
always re-encodes; there is no passthrough trim. Cutting a clip therefore costs
one encode no matter what. "Don't compress" means we do not additionally apply
the compression policy.

### Trim

New Swift file in `rnmodules/kb-common/src/`, wrapping
`UIVideoEditorController`, presented from RN, iOS only. Returns the edited path,
or nil on cancel.

Detecting whether the user actually trimmed: compare the output duration against
the source duration within a small epsilon. If unchanged, discard the editor's
output and keep the original path. This is what makes untrimmed +
don't-compress a true passthrough rather than a silent re-encode.

The editor's own `videoQuality` is set high, since its export is the
"minimal compression" encode in the trimmed + don't-compress case.

### JS bridge

`rnmodules/react-native-kb/src/NativeKb.ts` gains, iOS-implemented:

- `trimVideo(path: string): Promise<string | null>`
- `processMedia(path: string, isVideo: boolean, compress: boolean): Promise<string>`
- progress events for the export

`KBCommon` is already linked into the main `Keybase` target
(`shared/ios/Podfile:19`), so this is a spec change plus `yarn ios:pod:install`,
not a new pod.

Android: these are iOS-only. Android callers must not invoke them; the
get-titles screen gates on `Styles.isIOS`.

### Get-titles screen

`shared/chat/conversation/attachment-get-titles.tsx` gains:

- a Trim affordance per video row, iOS only
- a read of the global compress preference
- a `processMedia` pass with real progress before send

`MediaUtils.processVideoAsync` already exposes a progress callback
(`MediaUtils.swift:112`).

### Share extension shrinks to a copy

`sendMedia` (`ItemProviderHelper.swift:317-331`) already copies the original into
the `group.keybase` app-group payload folder at line 325. The subsequent
`handleAndCompleteMediaFile` call is dropped; the manifest is emitted with the
original only, via the existing
`completeItemAndAppendManifest(type:originalFileURL:)` overload at line 135.
Images take the same change, so the two flows do not re-diverge.

Consequences:

- `scaledPath` / `scaledSize` in the manifest go unpopulated. The Go side already
  tolerates this: `go/service/incoming-share.go:100-108` guards on
  `len(jsonItem.ScaledPath) > 0`. No Go change required, but verify.
- `shared/incoming-share/index.tsx:163-177` stops choosing between original and
  scaled — always original.
- `shared/fs/browser/destination-picker.tsx:42-59` already falls back to
  `originalPath` when `scaledPath` is absent. "Save in Files" therefore saves the
  original, which is the desired behavior.
- The extension gets faster and is far less likely to be killed mid-export.
  Compression moves to the foreground in the app, where the user is already
  waiting.

### Compression setting

Stays a persistent global preference, reusing the existing
`keybase.1.incomingShare.getPreference` / `setPreference` RPCs. The name is
share-specific but the value is just stored state; chat reads the same one
rather than introducing a second setting.

Known UX regression, accepted: the current chooser
(`shared/incoming-share/index.tsx:24-109`) shows byte sizes —
"Keep full size (12.4 MB)" vs "Compress (3.1 MB)" — which is only possible
because the extension has already produced the scaled file. Under this design
the compressed size is unknown until processing runs. The chooser moves to the
get-titles screen, shared by both flows, and shows the original size only. The
`originalOnly` special case (hide the chooser when compression would not help)
goes away with it.

### One picker dialog

`shared/chat/conversation/input-area/filepicker-popup/index.tsx:41-50` — the iOS
menu's "Choose video from library" and "Choose photos from library" merge into a
single "Choose from library" firing `('mixed', 'library')` with multi-select.
Android's menu is unchanged.

`shared/util/expo-image-picker.tsx`: `videoExportPreset` becomes `Passthrough`
and `allowsEditing` stays false, so iOS hands back the untouched original and
all processing happens in-app. Expo's passthrough fast-path
(`MediaHandler.swift:329`) returns the full-size original, which is what this
design wants — no `expo-image-picker` patch needed.

This supersedes PR #29485: its `MediumQuality` preset would become the first of
two encodes. #29485 stays as the stopgap for the current release; this work
reverts that line.

## Non-goals

- Android trim. Android keeps its existing flow and shows no trim affordance.
- A per-send compression toggle. Global setting only, for now.
- Custom trim UI. `UIVideoEditorController` is Apple's stock trimmer.

## Accepted risks

- An Android user and an iOS user attaching the same clip get identical bytes
  only when neither trims, since Android has no trim.
- Compressed-size preview in the chooser is lost (see above).
- Compression happens in the foreground. The user waits with a progress
  indicator instead of the work happening during the share sheet. Accepted: the
  wait exists either way.
