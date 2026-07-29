# Unified Asset Trim + Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the iOS share extension and in-chat attach functionally equivalent for assets — one compression policy, an optional trim step, identical output bytes for the same input.

**Architecture:** The share extension stops processing and becomes a copy-plus-manifest hand-off. Both flows converge on the existing `chatAttachmentGetTitles` screen, which is where trim and compression now happen, driven by a single `MediaUtils` policy exposed to JS through the `Kb` TurboModule.

**Tech Stack:** Swift (`KBCommon` pod), Objective-C++ (`Kb.mm` TurboModule), Kotlin (Android stubs), TypeScript/React Native.

## Global Constraints

- Design doc: `plans/2026-07-28-unified-video-trim-compress-design.md`. Read it first.
- Trim is **iOS-only**. Android keeps its existing flow and shows no trim affordance.
- Compression policy lives in exactly one place: `MediaProcessingConfig` / `MediaUtils`. No second policy, no per-flow settings argument.
- The "don't compress" setting is a **global** preference, reusing `keybase.1.incomingShare.getPreference` / `setPreference`. No per-send toggle.
- Repo root is `client/`. TS source is in `shared/`. Always use absolute paths for file ops; for Bash, `cd shared/` first.
- Never use `npm`. Always `yarn`.
- After TS changes, from `shared/`: `yarn lint` then `yarn tsc`. Never delete the ESLint cache.
- No DOM elements in `.tsx` — use `Kb.*`.
- Exact versions in `package.json` (no `^`/`~`).
- No `Co-Authored-By` in commits.
- Never interact with the iOS simulator or take screenshots. The user drives and verifies all visual/device behavior.
- Native spec changes require `yarn ios:pod:install` before the app will build.

## Verification Reality

There is no test harness for Swift or for `UIVideoEditorController`, and jest cannot exercise the TurboModule. Tasks therefore verify via:

- `yarn lint` and `yarn tsc` from `shared/` for all TS changes
- jest for pure TS helpers, where one exists to test
- compile/`pod install` success for native changes
- an explicit **manual device checklist** the user runs at the end (Task 9)

Do not claim a native task "works" — claim it compiles, and defer behavior to the checklist.

---

### Task 1: Single compression policy in MediaUtils

**Files:**
- Modify: `rnmodules/kb-common/src/MediaUtils.swift:178-199` (remove threshold branch)
- Modify: `rnmodules/kb-common/src/MediaUtils.swift:96-154` (thread a `compress` flag through)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `MediaUtils.processVideo(fromOriginal url: URL, compress: Bool, completion: @escaping (Error?, URL?) -> Void)`
  - `MediaUtils.processImage(fromOriginal url: URL, compress: Bool, completion: @escaping (Error?, URL?) -> Void)`
  - `MediaUtils.processVideoAsync(fromOriginal:compress:progress:completion:)`
  - When `compress` is false and no trim happened upstream, `processVideo` returns the **input URL unchanged** (no copy, no export).

- [ ] **Step 1: Replace the threshold branch with the caller's intent**

Replace `determineOptimalExportSettings` (lines 178-199) entirely:

```swift
    private static func exportSettings(compress: Bool) -> VideoExportSettings {
        // One policy, two outcomes. Callers decide whether to compress; the
        // policy itself never varies by source size. Changing MediumQuality
        // here changes it for both the share extension and in-chat attach.
        return compress ? VideoExportSettings.mediumQuality : VideoExportSettings.passthrough
    }
```

- [ ] **Step 2: Thread `compress` through the video entry points**

`processVideo` (line 96), `processVideoAsync` (line 110) and `processVideoSync` (line 129) each gain a `compress: Bool` parameter, passed straight down. In `processVideoSync`, short-circuit before doing any work when not compressing:

```swift
    private static func processVideoSync(
        fromOriginal url: URL,
        compress: Bool,
        progress: ProcessMediaProgressCallback? = nil
    ) throws -> URL {
        guard FileManager.default.fileExists(atPath: url.path) else {
            throw MediaUtilsError.invalidInput("File does not exist at path: \(url.path)")
        }

        // Passthrough means the caller wants the original bytes. Exporting
        // would rewrite the container for no benefit, so hand back the input.
        if !compress {
            return url
        }

        let asset = AVURLAsset(url: url)
        try validateVideoAsset(asset)

        let basename = url.deletingPathExtension().lastPathComponent
        let parent = url.deletingLastPathComponent()
        let processedURL = parent.appendingPathComponent("\(basename).processed.mp4")

        try exportVideoWithSettings(
            asset: asset,
            outputURL: processedURL,
            settings: exportSettings(compress: compress),
            progress: progress)

        return processedURL
    }
```

- [ ] **Step 3: Thread `compress` through the image entry points**

`processImage` (line 42), `processImageAsync` (line 56) and `processImageSync` (line 74) gain the same `compress: Bool`. When false, `processImageSync` returns `url` unchanged before any scaling or EXIF work.

- [ ] **Step 4: Fix the one existing caller so the pod still compiles**

`rnmodules/kb-common/src/ItemProviderHelper.swift:191-195` calls both functions. Pass `compress: true` for now — Task 6 removes these calls entirely. This keeps every intermediate commit buildable.

- [ ] **Step 5: Verify it compiles**

Run from repo root:

```bash
cd shared && yarn ios:pod:install
```

Expected: pod install completes without Swift errors. If the user has a build running, ask before touching the workspace.

- [ ] **Step 6: Commit**

```bash
git add rnmodules/kb-common/src/MediaUtils.swift rnmodules/kb-common/src/ItemProviderHelper.swift
git commit -m "refactor(media): single compression policy, caller states intent

determineOptimalExportSettings branched on source size, so a clip under
1920x1080 and 50MB passed through untouched while a larger one was
compressed. Replace it with an explicit compress flag: callers say what
they want, and the policy itself is one constant both flows share."
```

---

### Task 2: UIVideoEditorController trim wrapper

**Files:**
- Create: `rnmodules/kb-common/src/VideoTrim.swift`

**Interfaces:**
- Consumes: nothing.
- Produces: `VideoTrim.present(path: String, highQuality: Bool, completion: @escaping (String?, Error?) -> Void)`.
  Completion receives `nil` path for **both** cancel and "user did not actually change the range" — callers keep their original path in either case.

- [ ] **Step 1: Write the wrapper**

```swift
import AVFoundation
import UIKit

// UIVideoEditorController always re-encodes; there is no passthrough trim.
// So a cut costs one encode no matter what. To keep "don't compress" honest
// for untouched clips, we compare durations afterwards and throw away the
// editor's output when the user did not actually move the handles.
@objc(VideoTrim)
public class VideoTrim: NSObject, UIVideoEditorControllerDelegate, UINavigationControllerDelegate {
    private static let durationEpsilon: Double = 0.05

    private var completion: ((String?, Error?) -> Void)?
    private var sourceDuration: Double = 0
    private static var inFlight: VideoTrim?

    @objc public static func present(
        path: String,
        highQuality: Bool,
        completion: @escaping (String?, Error?) -> Void
    ) {
        DispatchQueue.main.async {
            guard UIVideoEditorController.canEditVideo(atPath: path) else {
                completion(nil, MediaUtilsError.invalidInput("Video cannot be edited: \(path)"))
                return
            }
            guard let root = Self.topViewController() else {
                completion(nil, MediaUtilsError.invalidInput("No view controller to present from"))
                return
            }

            let helper = VideoTrim()
            helper.completion = completion
            helper.sourceDuration = CMTimeGetSeconds(AVURLAsset(url: URL(fileURLWithPath: path)).duration)
            // Retained for the lifetime of the modal: UIVideoEditorController
            // holds its delegate weakly.
            Self.inFlight = helper

            let editor = UIVideoEditorController()
            editor.videoPath = path
            editor.videoQuality = highQuality ? .typeHigh : .typeMedium
            editor.delegate = helper
            root.present(editor, animated: true)
        }
    }

    private static func topViewController() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.windows.first { $0.isKeyWindow }?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    private func finish(_ editor: UIVideoEditorController, path: String?, error: Error?) {
        let done = completion
        completion = nil
        editor.dismiss(animated: true) {
            VideoTrim.inFlight = nil
            done?(path, error)
        }
    }

    public func videoEditorController(_ editor: UIVideoEditorController, didSaveEditedVideoToPath editedVideoPath: String) {
        let editedDuration = CMTimeGetSeconds(AVURLAsset(url: URL(fileURLWithPath: editedVideoPath)).duration)
        let unchanged = abs(editedDuration - sourceDuration) < VideoTrim.durationEpsilon
        if unchanged {
            try? FileManager.default.removeItem(atPath: editedVideoPath)
        }
        finish(editor, path: unchanged ? nil : editedVideoPath, error: nil)
    }

    public func videoEditorController(_ editor: UIVideoEditorController, didFailWithError error: Error) {
        finish(editor, path: nil, error: error)
    }

    public func videoEditorControllerDidCancel(_ editor: UIVideoEditorController) {
        finish(editor, path: nil, error: nil)
    }
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd shared && yarn ios:pod:install
```

The podspec already globs `src/**/*.{h,m,swift}` (`rnmodules/kb-common/KBCommon.podspec`), so no podspec edit is needed.

- [ ] **Step 3: Commit**

```bash
git add rnmodules/kb-common/src/VideoTrim.swift
git commit -m "feat(media): UIVideoEditorController trim wrapper

Returns nil when the user cancels or leaves the range untouched, so an
unedited clip keeps its original bytes instead of picking up a silent
re-encode from the editor's export."
```

---

### Task 3: Expose trim and processing to JS

**Files:**
- Modify: `rnmodules/react-native-kb/src/NativeKb.ts`
- Modify: `rnmodules/react-native-kb/ios/Kb.mm`
- Modify: `rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt`

**Interfaces:**
- Consumes: Task 1's `processVideo`/`processImage`, Task 2's `VideoTrim.present`.
- Produces, on the `Kb` TurboModule:
  - `trimVideo(path: string): Promise<string | null>`
  - `processMedia(path: string, isVideo: boolean, compress: boolean): Promise<string>`
  - `onMediaProgress: EventEmitter<{path: string; progress: number}>`

- [ ] **Step 1: Add to the TurboModule spec**

In `rnmodules/react-native-kb/src/NativeKb.ts`, add to the emitter block at the top:

```ts
  readonly onMediaProgress: EventEmitter<{path: string; progress: number}>
```

and alongside `iosGetHasShownPushPrompt`:

```ts
  // iOS only; Android rejects
  trimVideo(path: string): Promise<string | null>
  processMedia(path: string, isVideo: boolean, compress: boolean): Promise<string>
```

- [ ] **Step 2: Implement on iOS**

`Kb.mm` already imports `<KBCommon/KBCommon-Swift.h>` (line 14), so both Swift classes are visible. Add near `iosGetHasShownPushPrompt` (line 346):

```objc
RCT_EXPORT_METHOD(trimVideo:(NSString *)path resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  [VideoTrim presentWithPath:path highQuality:YES completion:^(NSString *edited, NSError *error) {
    if (error) {
      reject(@"trim_error", error.localizedDescription, error);
    } else if (edited) {
      resolve(edited);
    } else {
      // canceled, or the range was never changed
      resolve([NSNull null]);
    }
  }];
}

RCT_EXPORT_METHOD(processMedia:(NSString *)path isVideo:(BOOL)isVideo compress:(BOOL)compress resolve:(RCTPromiseResolveBlock)resolve reject:(RCTPromiseRejectBlock)reject) {
  NSURL *url = [NSURL fileURLWithPath:path];
  void (^done)(NSError *, NSURL *) = ^(NSError *error, NSURL *out) {
    if (error) {
      reject(@"process_media_error", error.localizedDescription, error);
    } else {
      resolve(out.path);
    }
  };
  if (isVideo) {
    [MediaUtils processVideoFromOriginal:url compress:compress completion:done];
  } else {
    [MediaUtils processImageFromOriginal:url compress:compress completion:done];
  }
}
```

Note: `highQuality:YES` is deliberate. The editor's export is the only encode when compression is off, and when compression is on `MediaUtils` re-encodes afterwards — starting that from a high-quality intermediate keeps the loss down. A trimmed clip with compression on therefore costs two encodes; this is a known, accepted cost (`UIVideoEditorController` does not expose the chosen range, so we cannot do a single combined export).

If the generated Objective-C selector names differ from the guesses above, read the generated `KBCommon-Swift.h` in the Pods directory and match them exactly rather than adding `@objc(name:)` annotations blindly.

- [ ] **Step 3: Stub on Android**

Codegen requires every spec method to be implemented. Follow the existing `iosGetHasShownPushPrompt` pattern (`KbModule.kt:566-569`):

```kotlin
    @ReactMethod
    override fun trimVideo(path: String, promise: Promise) {
        promise.reject(Exception("wrong platform"))
    }

    @ReactMethod
    override fun processMedia(path: String, isVideo: Boolean, compress: Boolean, promise: Promise) {
        promise.reject(Exception("wrong platform"))
    }
```

- [ ] **Step 4: Regenerate and verify**

```bash
cd shared && yarn ios:pod:install && yarn tsc
```

Expected: pod install regenerates `RNKbSpec.h` with the new methods and compiles; `tsc` passes. A stale `node_modules` breaks codegen — if the generated spec lacks the new methods, run `yarn` first.

- [ ] **Step 5: Commit**

```bash
git add rnmodules/react-native-kb/src/NativeKb.ts rnmodules/react-native-kb/ios/Kb.mm rnmodules/react-native-kb/android/src/main/java/com/reactnativekb/KbModule.kt
git commit -m "feat(media): bridge trimVideo and processMedia to JS

iOS only; Android rejects, matching iosGetHasShownPushPrompt."
```

---

### Task 4: TS media-processing helper

**Files:**
- Create: `shared/util/media-process.tsx`
- Create: `shared/util/__tests__/media-process.test.tsx`

**Interfaces:**
- Consumes: Task 3's `trimVideo` / `processMedia`.
- Produces:
  - `isVideoPath(path: string): boolean`
  - `canTrim(path: string): boolean` — true only on iOS, and only for video paths
  - `trimVideo(path: string): Promise<string>` — resolves to the trimmed path, or the input path unchanged on cancel/no-op
  - `processPaths(paths: ReadonlyArray<string>, compress: boolean, onProgress?: (done: number, total: number) => void): Promise<Array<string>>`

- [ ] **Step 1: Write the failing test for the pure helpers**

`shared/util/__tests__/media-process.test.tsx`:

```tsx
import {isVideoPath} from '../media-process'

describe('isVideoPath', () => {
  it('matches common video extensions case-insensitively', () => {
    expect(isVideoPath('/tmp/clip.mp4')).toBe(true)
    expect(isVideoPath('/tmp/clip.MOV')).toBe(true)
    expect(isVideoPath('/tmp/clip.mkv')).toBe(true)
  })

  it('rejects images and other files', () => {
    expect(isVideoPath('/tmp/photo.jpg')).toBe(false)
    expect(isVideoPath('/tmp/doc.pdf')).toBe(false)
    expect(isVideoPath('/tmp/movie')).toBe(false)
  })
})
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd shared && yarn jest util/__tests__/media-process.test.tsx
```

Expected: FAIL, cannot resolve `../media-process`.

- [ ] **Step 3: Write the helper**

```tsx
import {NativeModules} from 'react-native'
import * as Styles from '@/styles'

const videoFileNameRegex = /[^/]+\.(mp4|mov|avi|mkv)$/i

export const isVideoPath = (path: string) => videoFileNameRegex.test(path)

export const canTrim = (path: string) => Styles.isIOS && isVideoPath(path)

// Resolves to the trimmed path, or the input path when the user cancels or
// leaves the range alone. Callers never have to distinguish those cases.
export const trimVideo = async (path: string): Promise<string> => {
  if (!canTrim(path)) return path
  try {
    const edited = await NativeModules.Kb.trimVideo(path)
    return edited ?? path
  } catch {
    return path
  }
}

export const processPaths = async (
  paths: ReadonlyArray<string>,
  compress: boolean,
  onProgress?: (done: number, total: number) => void
): Promise<Array<string>> => {
  if (!Styles.isIOS) return [...paths]
  const out: Array<string> = []
  for (const [idx, path] of paths.entries()) {
    try {
      out.push(await NativeModules.Kb.processMedia(path, isVideoPath(path), compress))
    } catch {
      // Processing is best-effort: an unsupported or corrupt file still gets
      // sent, just unprocessed.
      out.push(path)
    }
    onProgress?.(idx + 1, paths.length)
  }
  return out
}
```

Use whatever import the repo already uses to reach the `Kb` TurboModule — check how another caller imports it (`grep -rn "NativeKb\|NativeModules.Kb" shared/ --include="*.tsx"`) and match that rather than the placeholder above.

- [ ] **Step 4: Run the test and confirm it passes**

```bash
cd shared && yarn jest util/__tests__/media-process.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Lint and typecheck**

```bash
cd shared && yarn lint && yarn tsc
```

- [ ] **Step 6: Commit**

```bash
git add shared/util/media-process.tsx shared/util/__tests__/media-process.test.tsx
git commit -m "feat(media): TS helper for trim and processing"
```

---

### Task 5: Trim + compress on the get-titles screen

**Files:**
- Modify: `shared/chat/conversation/attachment-get-titles.tsx`

**Interfaces:**
- Consumes: Task 4's `canTrim`, `trimVideo`, `processPaths`.
- Produces: nothing downstream.

This screen is a one-item-at-a-time carousel keyed on `index`, not a row list, so the trim affordance belongs next to the current item's preview.

- [ ] **Step 1: Track per-item path overrides**

`pathAndOutboxIDs` is a prop and must not be mutated. Add state mapping index to a replacement path, and have `pathAndInfos` (line 98) read through it:

```tsx
  const [trimmedPaths, setTrimmedPaths] = React.useState<{[index: number]: string}>({})
  const pathAndInfos = pathAndOutboxIDs.map(({path, outboxID, url}, idx) => {
    const effectivePath = trimmedPaths[idx] ?? path
    // ...unchanged, but built from effectivePath
  })
```

- [ ] **Step 2: Add the trim affordance under the video preview**

In the `case 'video':` branch of the `preview` switch, wrap the existing `Kb.Video` so the button sits beneath it, rendering only when `canTrim(path)`:

```tsx
    case 'video':
      preview = path ? (
        <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} gap="tiny">
          <Kb.Video autoPlay={false} allowFile={true} muted={true} url={path} />
          {canTrim(path) ? (
            <Kb.Button
              type="Dim"
              small={true}
              label="Trim"
              onClick={() => {
                C.ignorePromise(
                  (async () => {
                    const trimmed = await trimVideo(path)
                    if (trimmed !== path) {
                      setTrimmedPaths(s => ({...s, [index]: trimmed}))
                    }
                  })()
                )
              }}
            />
          ) : null}
        </Kb.Box2>
      ) : null
      break
```

- [ ] **Step 3: Read the global compress preference**

Mirror the existing read in `shared/incoming-share/index.tsx:38-52` — `T.RPCGen.incomingShareGetPreferenceRpcPromise`, compared against `T.RPCGen.IncomingShareCompressPreference.original`. Store it in local state; treat "not yet loaded" as compress-on so a fast Send never accidentally uploads originals.

- [ ] **Step 4: Process before upload**

`_onSubmit` (line 69) currently builds `uploadArgs` from `pathAndOutboxIDs` directly. Insert processing before the upload call, preserving the `outboxID` alongside each path:

```tsx
  const [processing, setProcessing] = React.useState(false)
  const _onSubmit = (titles: Array<string>) => {
    const effective = pathAndOutboxIDs.map(({path, outboxID, url}, idx) => ({
      outboxID,
      path: trimmedPaths[idx] ?? path,
      url,
    }))
    setProcessing(true)
    C.ignorePromise(
      (async () => {
        const processed = await processPaths(
          effective.map(p => p.path),
          compress
        )
        setProcessing(false)
        const paths = effective.map((p, idx) => ({...p, path: processed[idx] ?? p.path}))
        // ...existing uploadArgs, with paths
      })()
    )
  }
```

Disable the Send / Send All buttons and show a progress indicator while `processing` is true, so the user cannot double-submit during a long export.

- [ ] **Step 5: Skip processing for non-media**

`processPaths` must not run on `type === 'file'` items, and must not run on KBFS paths (`isKbfsPath`, line 46) — those are not local files the native side can read. Pass them through untouched.

- [ ] **Step 6: Lint and typecheck**

```bash
cd shared && yarn lint && yarn tsc
```

- [ ] **Step 7: Commit**

```bash
git add shared/chat/conversation/attachment-get-titles.tsx
git commit -m "feat(chat): trim and compress attachments on the get-titles screen

Both the in-chat picker and the share extension land here, so this is the
one place assets get processed."
```

---

### Task 6: Share extension becomes a copy

**Files:**
- Modify: `rnmodules/kb-common/src/ItemProviderHelper.swift:175-197` (delete `handleAndCompleteMediaFile`)
- Modify: `rnmodules/kb-common/src/ItemProviderHelper.swift:317-345` (`sendMedia`, `sendImage`)
- Modify: `shared/incoming-share/index.tsx:163-177`

**Interfaces:**
- Consumes: nothing.
- Produces: manifests with `originalPath` only; `scaledPath` is never populated.

- [ ] **Step 1: Drop in-extension processing**

`sendMedia` already copies the original into the app-group payload folder at line 325. Replace the trailing `handleAndCompleteMediaFile(filePayloadURL, isVideo: isVideo)` with the original-only manifest overload that already exists at line 135:

```swift
      completeItemAndAppendManifest(type: isVideo ? "video" : "image", originalFileURL: filePayloadURL)
```

Do the same in `sendImage` (line 338). Then delete `handleAndCompleteMediaFile` entirely, and the now-unused
`completeItemAndAppendManifest(type:originalFileURL:scaledFileURL:)` overload at line 149 if nothing else calls it.

Update the stale comment above `sendMedia` (lines 315-316) — it currently says the manifest carries both original and compressed versions.

- [ ] **Step 2: Always send the original from the share screen**

`shared/incoming-share/index.tsx:163-177` — drop the `scaledPath` branch:

```tsx
      if (item.originalPath) {
        return {sendPaths: [...sendPaths, item.originalPath], text}
      }
```

`useOriginalValue` is no longer read here. Remove the now-dead `useConfigState(s => s.incomingShareUseOriginal)` read at line 162 if nothing else in the component uses it.

- [ ] **Step 3: Retire the size-labelled chooser**

`OriginalOrCompressedButton` (lines 24-109) shows byte sizes — "Keep full size (12.4 MB)" vs "Compress (3.1 MB)" — which only worked because the extension had already produced the scaled file. Those sizes are unknowable now. Per the design, remove this component and its `getIncomingShareSizes` helper (lines 15-22), along with the `originalOnly` special case. The setting itself survives; it is read on the get-titles screen (Task 5) and set from settings.

Check for other callers first: `grep -rn "OriginalOrCompressedButton\|getIncomingShareSizes" shared/`. `shared/incoming-share/routes.tsx` is the likely one — remove it from the header there.

- [ ] **Step 4: Confirm the Go side tolerates a missing scaledPath**

Read `go/service/incoming-share.go:100-108`. It guards on `len(jsonItem.ScaledPath) > 0`, so an absent value yields a nil pointer and zero size — no error, no Go change. Confirm by reading; do not modify Go.

Also confirm `shared/fs/browser/destination-picker.tsx:42-59` falls back to `originalPath` when `scaledPath` is absent — it already does, so "Save in Files" saves the original.

- [ ] **Step 5: Verify**

```bash
cd shared && yarn ios:pod:install && yarn lint && yarn tsc
```

- [ ] **Step 6: Commit**

```bash
git add rnmodules/kb-common/src/ItemProviderHelper.swift shared/incoming-share/
git commit -m "refactor(share): extension copies, the app processes

Compressing inside the extension meant a shared video could not be
trimmed afterwards without encoding twice, and the two flows produced
different bytes for the same clip. The extension now copies into the app
group and writes the manifest; all processing happens on the get-titles
screen. Extensions also have tight memory budgets and get killed
mid-export, which the app does not."
```

---

### Task 7: One picker dialog, passthrough picks

**Files:**
- Modify: `shared/chat/conversation/input-area/filepicker-popup/index.tsx:41-50`
- Modify: `shared/util/expo-image-picker.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: picks that hand back untouched originals.

- [ ] **Step 1: Merge the two iOS library entries**

In the `isIOS` branch, replace the separate "Choose video from library" and "Choose photos from library" items with one:

```tsx
        {
          icon: 'iconfont-photo-library',
          onClick: () => onSelect('mixed', 'library'),
          title: 'Choose from library',
        },
```

Leave the Android branch (lines 57-79) exactly as it is.

- [ ] **Step 2: Make picks passthrough**

In `shared/util/expo-image-picker.tsx`, `getDefaultOptions`:

- `videoExportPreset` → `ImagePicker.VideoExportPreset.Passthrough` (this reverts the `MediumQuality` line from PR #29485 — processing has moved into the app)
- `quality` → `1` so iOS does not JPEG-recompress images before `MediaUtils.processImage` sees them
- leave `videoQuality` as-is; it only affects camera capture

Replace the comment block with one explaining that picks are deliberately untouched because `MediaUtils` on the get-titles screen owns compression for both flows.

- [ ] **Step 3: Drop the forced editing path for video**

In `launchImageLibraryAsync`, remove the `...(mediaType === 'video' ? {allowsEditing: true, allowsMultipleSelection: false} : {})` spread. `allowsEditing` forced the legacy single-select picker purely to get UIKit's trimmer; trim is ours now, and multi-select is the point of the merged dialog.

With `allowsEditing` false, expo takes the `PHPickerViewController` path (`ImagePickerModule.swift:94`), and its passthrough fast-path (`MediaHandler.swift:329`) streams the untouched original — exactly what this design wants. No `expo-image-picker` patch is needed.

- [ ] **Step 4: Lint and typecheck**

```bash
cd shared && yarn lint && yarn tsc
```

- [ ] **Step 5: Commit**

```bash
git add shared/chat/conversation/input-area/filepicker-popup/index.tsx shared/util/expo-image-picker.tsx
git commit -m "feat(chat): one library picker, untouched picks

Photo and video library entries merge into a single multi-select entry.
Picks come back passthrough now that MediaUtils owns compression, which
supersedes the MediumQuality preset from #29485."
```

---

### Task 8: Point the compress setting at both flows

**Files:**
- Modify: wherever the preference is surfaced in settings (find it first)

**Interfaces:**
- Consumes: Task 5's read of the preference.
- Produces: nothing.

- [ ] **Step 1: Find where the setting is currently exposed**

```bash
cd shared && grep -rn "incomingShareUseOriginal\|incomingShareSetPreference" --include="*.tsx" . | grep -v node_modules
```

Task 6 removed the share-screen chooser, so verify the setting is still reachable from somewhere. If the share-screen gear was the *only* way to change it, add it to chat settings — a plain two-option row, labelled so it is clear it covers both sharing into Keybase and attaching in chat. Do not invent new copy beyond that; keep the existing "Keep full size" / "Compress" wording, minus the byte counts.

- [ ] **Step 2: Lint and typecheck**

```bash
cd shared && yarn lint && yarn tsc
```

- [ ] **Step 3: Commit**

```bash
git add -A shared/
git commit -m "feat(settings): compression setting covers both attach flows"
```

---

### Task 9: Manual device verification

**Files:** none.

- [ ] **Step 1: Hand the user this checklist**

The user drives the simulator/device. Do not attempt any of this yourself.

Compression **on** (default):
1. Chat → attach → Choose from library → pick a photo and a video together → Send. Both upload; video is visibly smaller than the source.
2. Same clip shared in from Photos → Send. Upload size matches step 1 byte-for-byte.
3. Chat → attach → video → Trim → cut a few seconds → Send. Uploads the trimmed clip.

Compression **off**:
4. Chat → attach → video → Send without trimming. Upload is byte-identical to the source.
5. Chat → attach → video → Trim → cut → Send. Uploads the trimmed clip at high quality.
6. Same clip shared in from Photos, no trim → Send. Byte-identical to step 4.

Regression checks:
7. Android: attach photo and video from library, and share in from another app. Menu still has separate photo/video entries, no Trim button, uploads succeed.
8. Share a non-media file and a URL into Keybase. Both still work.
9. Share into Keybase → "Save in Files" → saves the original.
10. Attach a KBFS file from the Files tab into chat. Still uploads, unprocessed.

- [ ] **Step 2: Fix whatever the checklist turns up, then open the PR**

Note in the PR body that this supersedes #29485.

---

## Self-Review Notes

- Spec coverage: policy (T1), trim (T2), bridge (T3), helper (T4), get-titles surface (T5), extension shrink + Go/FS check (T6), one dialog + passthrough picks (T7), setting reachability (T8), manual matrix (T9). All design sections are covered.
- Known accepted costs, both recorded in the design doc: a trimmed clip with compression on encodes twice, and the compressed-size preview in the chooser is gone.
- `MediaUtils.processVideo`/`processImage` gain `compress:` in Task 1 and every caller is updated in the same task, so no intermediate commit is left uncompilable.
