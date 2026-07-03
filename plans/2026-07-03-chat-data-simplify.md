# Chat Data Layer Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Collapse duplicated chat data ownership on the JS side — one owner for conversation meta, no hand-maintained inbox row cache, a decomposed thread-context — plus a set of small state cleanups.

**Architecture:** Conversation meta/participants get a single owner (`useInboxMetadataState`); the per-conversation thread store stops holding copies and stops writing back. The `rows-state` materialized view is replaced by selector hooks computed from meta + a new tiny badge store + layout + typing. `thread-context.tsx` is split into store/actions, engine listeners, and load logic. Converters and parse paths are deduplicated. Each task is one commit on a fresh branch.

**Tech Stack:** TypeScript, React, zustand (global via `Z.createZustand`, per-conversation via vanilla `createStore`), immer, jest.

## Global Constraints

- Repo root is `client/`; TS source in `shared/`. All Bash runs `cd /Users/chrisnojima/go/src/github.com/keybase/client/shared` first. File ops use absolute paths.
- After TS changes: `yarn lint` then `yarn tsc` (from `shared/`). Both must be clean before each commit. tsc errors are never "pre-existing" (exception: known `react-native-kb` `install` error in client2 — not in this tree's tsc run).
- Never use `npm`. Never touch Electron app or iOS simulator. User verifies visuals.
- No `Co-Authored-By` in commits.
- No DOM elements in plain `.tsx`; use `Kb.*`.
- Remove unused code (imports, vars, params, dead helpers) in every file touched.
- Comments only for non-obvious constraints; no refactoring-history comments.
- In tests use `testuser` / `testuser-mac` usernames.
- Do NOT push. Branch stays local until the user verifies the app.
- Behavior-preserving refactor: no feature/behavior drops. If a task forces a behavior question, STOP and surface options instead of deciding silently.
- `git diff` output is rtk-filtered to stats in this environment; to inspect content use `git show` / read files directly.
- Existing tests that must keep passing: `yarn jest stores chat` (covers `shared/stores/tests/*` and `shared/chat/**/*.test.*`). Run per task; full `yarn jest` before final handoff.

---

### Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create branch**

```bash
cd /Users/chrisnojima/go/src/github.com/keybase/client
git checkout -b nojima/chat-data-simplify
```

- [ ] **Step 2: Baseline validation** — record a clean starting point.

```bash
cd shared && yarn lint && yarn tsc && yarn jest stores chat
```

Expected: all pass. If anything fails at baseline, STOP and report (do not fix pre-existing failures inside this plan).

---

### Task 1: Unify InboxUIItem→ConversationMeta converters

**Files:**
- Modify: `shared/constants/chat/meta.tsx`
- Test: `shared/stores/tests/chat.test.ts` (extend) or new `shared/constants/chat/meta.test.tsx` if converters aren't covered there.

**Interfaces:**
- Produces: internal helper `baseMetaFromUIItem` in `meta.tsx`. Public exports (`inboxUIItemToConversationMeta`, `unverifiedInboxUIItemToConversationMeta`, `inboxUIItemErrorToConversationMetaAndParticipants`, `makeConversationMeta`, `updateMeta`, `parseNotificationSettings`, `getEffectiveRetentionPolicy`, `getRowParticipants`, `getTeams`, `getTeamType` if exported) unchanged in name and signature.

`inboxUIItemToConversationMeta` (meta.tsx:276) and `unverifiedInboxUIItemToConversationMeta` (meta.tsx:27) share ~20 field mappings. Extract the shared subset. `InboxUIItem` and `UnverifiedInboxUIItem` share: `convID`, `name`, `status`, `membersType`, `memberStatus`, `visibility`, `time`, `version`, `localVersion`, `maxMsgID`, `maxVisibleMsgID`, `readMsgID`, `convRetention`, `teamRetention`, `notifications`, `supersededBy`, `supersedes`, `finalizeInfo`, `draft`, `commands`, `teamType`, `tlfID`. Verify the exact shared shape against `T.RPCChat` types before writing the helper — if a listed field is missing on one type, move it back to the specific converter.

- [ ] **Step 1: Write characterization tests first** (before touching converters). Build a representative `InboxUIItem` and `UnverifiedInboxUIItem` fixture (team + adhoc + muted + retention-set variants), snapshot/assert the produced metas field-by-field for the important fields (`trustedState`, `snippet`, `channelname`, `teamname`, `resetParticipants`, `retentionPolicy`, `notificationsDesktop`, `supersededBy`). Run: `yarn jest <testfile>` — expect PASS against current code.

```ts
// shape of the test (fill fixtures from T.RPCChat types):
describe('meta converters', () => {
  it('trusted item maps fields', () => {
    const meta = inboxUIItemToConversationMeta(trustedFixture)
    expect(meta?.trustedState).toBe('trusted')
    // ... field asserts
  })
  it('unverified item maps fields', () => {
    const meta = unverifiedInboxUIItemToConversationMeta(unverifiedFixture)
    expect(meta?.trustedState).toBe('untrusted')
    // ... field asserts; assert fields the unverified path must NOT set (botAliases etc. stay defaults)
  })
})
```

- [ ] **Step 2: Extract `baseMetaFromUIItem`** covering the shared mappings (visibility guard, resetParticipants impteam logic, supersede decode, retention, notifications, membershipType, ids/versions/timestamps, draft, status, tlfname, wasFinalizedBy, teamType via `getTeamType`). Each public converter becomes: guard clauses specific to it + `{...makeConversationMeta(), ...baseMetaFromUIItem(i, isTeam), ...specific fields}`.
- [ ] **Step 3: Run tests** — `yarn jest <testfile>` PASS unchanged.
- [ ] **Step 4: Validate + commit**

```bash
yarn lint && yarn tsc && yarn jest stores chat
git add -A && git commit -m "refactor(chat): dedupe InboxUIItem meta converters via shared base helper"
```

---

### Task 2: Shared UIMessages parse helper

**Files:**
- Modify: `shared/constants/chat/message.tsx` (add `parseUIMessagesJSON`), `shared/chat/conversation/data-hooks.tsx:160-189`, `shared/chat/conversation/thread-context.tsx:781-796`

**Interfaces:**
- Produces: `export const parseUIMessagesJSON = (conversationIDKey: T.Chat.ConversationIDKey, threadJSON: string, username: string, devicename: string, getLastOrdinal: () => T.Chat.Ordinal) => Array<T.Chat.Message>` in `constants/chat/message.tsx`. JSON.parse + per-message `uiMessageToMessage`, dropping nulls. Errors: catch, `logger.warn`, return `[]` (matching data-hooks behavior; thread-context currently doesn't catch — keep thread-context's call NOT swallowing? No: unify on catch+warn+[] and verify thread-context call sites tolerate empty array — they do, `applyThreadLoad` with 0 messages is a no-op add).
- Consumers keep their own `getLastOrdinal` semantics: thread-context passes its snapshot-based lambda; data-hooks passes its running-max lambda.

- [ ] **Step 1: Add helper to `message.tsx`** (near `uiMessageToMessage`).
- [ ] **Step 2: Replace `parseThreadMessages` body in data-hooks** with a call to the helper (keep the running-max `getLastOrdinal` wrapper local).
- [ ] **Step 3: Replace the inline parse block in `loadConversationThreadMessages`** (`thread-context.tsx:782-796`) with the helper.
- [ ] **Step 4: Validate + commit** (same commands). Commit: `refactor(chat): shared UIMessages JSON parse helper`

---

### Task 3: Meta single-ownership — remove participants copy from thread store

Smallest slice of the ownership change first: participants.

**Files:**
- Modify: `shared/chat/conversation/thread-context.tsx`
- Modify: any component reading `participants` from the thread store (grep below)

**Interfaces:**
- Consumes: `useInboxMetadataState`, `getInboxConversationParticipants`, `participantInfoReceived` from `@/chat/inbox/metadata`; `useConversationParticipants` from `./data-hooks`.
- Produces: `ConversationThreadState` no longer has `participants`; `ConversationThreadActions` no longer has `setParticipants`.

Current wiring to remove: store field (`thread-context.tsx:206,241,258-260`), mirror effect (`:1629-1637`), `setParticipants` action (`:1164-1169`), `ChatParticipantsInfo` listener (`:1813-1818` — global coverage already exists: `chat/inbox/engine.tsx` routes `ChatParticipantsInfo` → `syncInboxParticipantsFromParticipantMap`, which writes the inbox store the mirror effect was reading from), `chatInboxFailed` participants branch (`:1762-1764` — replace with direct `participantInfoReceived(id, participants, meta)`).

- [ ] **Step 1: Find all readers**

```bash
rg -n "s\.participants|snapshot\.participants|state\.participants" chat/ --glob '*.tsx' | rg -v inbox/
rg -n "useConversationThreadSelector\(" chat/ -A2 | rg -i participants
```

- [ ] **Step 2: Repoint readers** to `useConversationParticipants(conversationIDKey)` (data-hooks) or, in non-hook code, `getInboxConversationParticipants(id) ?? emptyParticipantInfo`. `useConversationThreadSelectedConversation` (`thread-context.tsx:2057-2083`) reads `s.participants` — switch it to `getInboxConversationParticipants(conversationIDKey)` with an empty-info fallback.
- [ ] **Step 3: Delete** store field, `makeEmptyParticipantInfo` usage in state (keep the helper if still used elsewhere), initial seeding, mirror effect, `setParticipants` action + type, `ChatParticipantsInfo` listener. In the `chatInboxFailed` listener, replace `threadActions.setParticipants(participants)` with `participantInfoReceived(id, participants, meta)`.
- [ ] **Step 4: Verify no global-coverage regression.** Confirm `chat/inbox/engine.tsx` handles `ChatParticipantsInfo` unconditionally (not only for inbox-visible convs) — read `handleConvoEngineIncoming` and the wiring in `constants/init/shared.tsx:334-460`. If coverage is conditional, keep an equivalent write via `participantInfoReceived` where the listener was. Document finding in the commit message.
- [ ] **Step 5: Validate + commit.** `refactor(chat): thread store reads participants from inbox metadata store`

---

### Task 4: Meta single-ownership — remove meta copy from thread store

The core ownership change. The thread store's `meta` field, its bi-directional sync (`setMeta`/`updateMeta` → `metasReceived`), and every thread-context listener that exists only to refresh the local meta copy all go away. Reads come from `useInboxMetadataState`; writes flow one way: RPC/engine → `metasReceived` → inbox store → (subscribers).

**Files:**
- Modify: `shared/chat/conversation/thread-context.tsx` (major)
- Modify: components reading `s.meta` from the thread store (grep)
- Test: existing `chat/conversation/*.test.tsx` must keep passing.

**Interfaces:**
- Produces: `ConversationThreadState` without `meta`; `ConversationThreadActions` without `setMeta`/`updateMeta`. New module-local helper in thread-context: `const getMeta = (id: T.Chat.ConversationIDKey) => getInboxConversationMeta(id) ?? Meta.makeConversationMeta()`.
- Writes that used `setMeta`/`updateMeta` now call `metasReceived([...])` / `updateInboxConversationMeta(id, partial)` from `@/chat/inbox/metadata` directly.

Internal read sites to repoint (all become `getMeta(id)`):
- `loadConversationThreadMessages` membershipType/rekeyers bail (`:745-749`), offline write (`:862-864` → `updateInboxConversationMeta(conversationIDKey, {offline: results.offline})`)
- `markThreadAsRead` readMsgID noop check (`:996-998`)
- `applyThreadLoad` `maxVisibleMsgID` containsLatest calc (`:1069`)
- `setExplodingMode` retention lookup (`:1144`)
- `messageDelete` tlfname + meta-presence check (`:1237-1257`)
- `toggleMessageReaction` tlfname (`:1393`)
- `unfurlRemove` tlfname + presence check (`:1406-1415`)
- `setMarkAsUnread` maxVisibleMsgID (`:1180`)
- Note: presence checks like `snapshot.meta.conversationIDKey === id` become `getInboxConversationMeta(id) !== undefined` (or drop where vacuous).

Listeners to DELETE from thread-context (each only refreshed the local meta copy; global path already writes the inbox store):
- `NewChatActivity` sub-branches `setStatus`, `readMessage`, `newConversation` (`:1650-1679`) and the `applyInboxUIItemToThread` call inside `incomingMessage` (`:1645`) and `failedMessage` (`:1697`) — global: `inbox/engine.tsx` `onNewChatActivity` returns the `inboxUIItem`, `constants/init/shared.tsx` pushes it through `onIncomingInboxUIItem` → `hydrateInboxConversations` → `metasReceived`.
- `ChatConvUpdate` (`:1742-1748`) — global: engine routes to `metasReceived`.
- `ChatSetConvRetention` (`:1782-1797`), `ChatSetTeamRetention` (`:1798-1812`), `ChatSetConvSettings` (`:1766-1781`), `setAppNotificationSettings` branch (`:1680-1686`) — global: engine routes retention/settings to `metasReceived`/`updateInboxConversationMeta`; VERIFY each case exists in `handleConvoEngineIncoming` (`chat/inbox/engine.tsx:189+`) before deleting. `setAppNotificationSettings` in particular: engine's `onNewChatActivity` must handle it or return its conv; if not covered, replace the thread-context listener with a direct `updateInboxConversationMeta(id, Meta.parseNotificationSettings(...))` call instead of deleting.
- `chatInboxFailed` (`:1749-1765`) — global: engine routes `chatInboxFailed` → `metaReceivedError` which builds the same error meta + participants. Delete the thread-context copy entirely after confirming `metaReceivedError` covers rekey participants (it calls `participantInfoReceived`).

Helper functions that die with this: `applyConversationMetaToThread`, `applyInboxUIItemToThread` (`:688-710`). `Meta.updateMeta` version-gating remains used by the inbox store path (`metasReceived` consumers) — verify `metasReceived` applies version gating; TODAY it does NOT (it overwrites). The thread store previously gated via `applyConversationMetaToThread`. To preserve behavior (no stale-version overwrite thrash), add gating into `metasReceived`:

```ts
// metadata.tsx metasReceived body change:
metas.forEach(m => {
  const old = s.metas.get(m.conversationIDKey)
  const next = old ? Meta.updateMeta(old, m) : m
  s.metas.set(m.conversationIDKey, T.castDraft(next))
})
```

CAREFUL: some callers intentionally overwrite (error metas from `metaReceivedError` have same version but `trustedState:'error'`). `updateMeta` keeps old on equal version unless untrusted→trusted or localVersion bump — that would SWALLOW error metas and the `unverifiedInboxUIItemToConversationMeta`-based incremental sync. Resolution: add an options param `metasReceived(metas, removals?, {force?: boolean})`; pass `force: true` from `metaReceivedError`, `onChatInboxSynced` incremental, `clearConversationsForInboxSync` path, and `updateInboxConversationMeta` (which merges from current already); default (unbox results, NewChatActivity hydration, thread-store-removal call sites) goes through gating. Write a unit test for both behaviors in `chat/inbox/metadata.test.tsx`.

Components reading thread-store meta:

- [ ] **Step 1: Enumerate readers**

```bash
rg -n "useConversationThreadSelector\(s => s\.meta|snapshot\.meta|\.getState\(\)\.meta" chat/ --glob '*.tsx'
rg -n "s\.meta\b" chat/conversation --glob '*.tsx'
```

Repoint component readers to `useConversationMeta(id)` (data-hooks; id from `useConversationThreadID()`). For selectors that picked single fields (e.g. `s.meta.teamname`), use `useInboxMetadataState(s => s.metas.get(id)?.teamname ?? '')` or `useConversationMeta` + field access — prefer the narrow selector where the component is render-hot (message rows).

- [ ] **Step 2: Add version gating + force flag to `metasReceived`** with tests (as specified above). Commit separately if it stands alone: `fix(chat): version-gate metasReceived like thread-store path did`.
- [ ] **Step 3: Remove `meta` from `ConversationThreadState`**, seeding in `makeInitialThreadState`, `setMeta`/`updateMeta` actions, repoint all internal reads per the list above, delete dead helpers/listeners per the list above (with the per-listener global-coverage verification described — record each verification in the commit message body).
- [ ] **Step 4: Validate + commit.** `refactor(chat): single-owner conversation meta in inbox metadata store`

Run `yarn jest chat` and fix fallout in `chat/conversation/normal/container.test.tsx`, `chat/inbox/metadata.test.tsx`, `chat/inbox/engine.test.tsx` by updating them to the new ownership (tests asserting thread-store meta mirroring get deleted; tests asserting inbox-store writes stay).

---

### Task 5: Badge store + retire rows-state (staged)

Replace the hand-maintained `rows-state` materialized view with selector hooks over: metadata store + new badge store + layout store + a typing map. Five sync entry points and two divergent projections disappear.

**Files:**
- Create: `shared/chat/inbox/badge-state.tsx`
- Modify: `shared/chat/inbox/layout-state.tsx` (add per-conv row index selectors)
- Modify: `shared/chat/inbox/rows-state.tsx` → shrinks to row view hooks, then everything else deleted
- Modify: `shared/chat/inbox/metadata.tsx` (drop `syncInboxRows*` fan-out calls; trusted-state handling)
- Modify: `shared/chat/inbox/engine.tsx` (typing + badge routing), `shared/constants/init/shared.tsx` (badge routing)
- Modify consumers: `chat/inbox/row/small-team/index.tsx`, `chat/inbox/row/big-team-channel.tsx`, `chat/selectable-small-team.tsx`, `chat/selectable-big-team-channel.tsx`, `chat/inbox/use-inbox-state.tsx:22-58`, `chat/inbox/row/teams-divider-container.tsx:25`
- Test: `shared/chat/inbox/rows-state.test.ts` → replaced by `badge-state.test.ts` + row-hook tests; `metadata.test.tsx` updated.

**Interfaces:**
- Produces `badge-state.tsx`:

```ts
type BadgeCounts = {badgeCount: number; unreadCount: number}
export const useInboxBadgeState: Z store {counts: Map<T.Chat.ConversationIDKey, BadgeCounts>}
export const syncInboxBadgeState = (badgeState?: T.RPCGen.BadgeState) => void // full-replace semantics: convs absent from payload get no entry (map rebuilt each sync)
export const getInboxBadge = (id: T.Chat.ConversationIDKey): BadgeCounts // {0,0} default
```

- Produces typing map (goes into badge-state.tsx or its own 30-line `typing-state.tsx`): `useInboxTypingState {typing: Map<ConversationIDKey, ReadonlySet<string>>}` + `updateInboxTyping(updates)`. `buildTypingSnippet` moves next to its consumer hook.
- Produces in `rows-state.tsx` (file renamed responsibility, keep path to limit churn): `useInboxRowSmall(id): InboxRowSmall` and `useInboxRowBig(id): InboxRowBig` with the SAME return shapes as today (so row components change minimally), but computed via `useShallow` selectors:

```ts
export const useInboxRowSmall = (id: string): InboxRowSmall => {
  const you = useCurrentUserState(s => s.username)
  const meta = useInboxMetadataState(s => s.metas.get(id))
  const participantInfo = useInboxMetadataState(s => s.participants.get(id))
  const layoutRow = useInboxLayoutState(s => getSmallLayoutRow(s, id)) // memoized index
  const counts = useInboxBadgeState(s => s.counts.get(id))
  const typing = useInboxTypingState(s => s.typing.get(id))
  return React.useMemo(() => computeSmallRow(id, you, meta, participantInfo, layoutRow, counts, typing),
    [id, you, meta, participantInfo, layoutRow, counts, typing])
}
```

`computeSmallRow` merges with ONE precedence rule (fixes today's divergent projections): meta wins when `trustedState === 'trusted' || 'error'`; layout row fills gaps otherwise (snippet, draft, time, isMuted, name-split participants). ONE definition of `isDecryptingSnippet = !!id && !snippet && !metaTrusted`. `hasBadge`/`hasUnread` computed from counts — the stale-boolean class disappears.

- Trusted-state: rows-state's `trustedState`/`setInboxRowTrustedState` copy is replaced by: meta's own `trustedState` + the existing `inFlightUnboxRows` set. In `metadata.tsx`: `trustedStateForConversation(id) = metas.get(id)?.trustedState ?? (inFlightUnboxRows.has(id) ? 'requesting' : 'untrusted')`. `setInboxRowTrustedState` call sites: the 'requesting' marker (`metadata.tsx:444`) is covered by `inFlightUnboxRows`; the untrusted resets (`:79`, `:458`) are covered by removal from `inFlightUnboxRows` (finally block already deletes). The error case (`rows-state.tsx:315`) is covered by the error meta from `metaReceivedError`. `getInboxRowTrustedState` and `hasKnownMeta` fallback (`metadata.tsx:492-497`) become meta-store checks.

Stages (each its own commit):

- [ ] **Step 1: badge store.** Create `badge-state.tsx` + tests (badge applied, absent conv zeroed on next sync). Route `keybase.1.NotifyBadges.badgeState` (`constants/init/shared.tsx:346-352` via `syncBadgeState` in metadata.tsx) to it. Repoint aggregate consumers `use-inbox-state.tsx:22-58` and `teams-divider-container.tsx:25` to badge store. Keep rows-state badge sync temporarily (double-write) so rows stay correct. Commit: `feat(chat): dedicated inbox badge store`.
- [ ] **Step 2: typing map + layout index.** Add typing store; route `ChatTypingUpdate` in `engine.tsx` to it (keep rows-state write temporarily). Add memoized per-conv layout row index selectors to `layout-state.tsx` (`getSmallLayoutRow`, `getBigLayoutChannelRow`) — build Maps keyed by convID once per layout change (module-level WeakMap on the layout object or a zustand computed). Commit: `feat(chat): typing store + layout row index`.
- [ ] **Step 3: selector-based row hooks.** Rewrite `useInboxRowSmall`/`useInboxRowBig` as computed selectors (shapes unchanged). Port `rows-state.test.ts` assertions to drive the new hooks via store writes (use `@testing-library/react` renderHook if present in repo tests — check existing patterns in `chat/inbox/metadata.test.tsx` first and mirror them). Delete `applyMetaToRows`, `syncInboxRowsFromLayout`, `syncInboxRowsFrom*`, `syncInboxRowBadgeState`, `updateInboxRowTyping`, `setInboxRowTrustedState`, `getInboxRowTrustedState`, the `rowsBig/rowsSmall` store, and every `syncInboxRows*` call in `metadata.tsx` (`:108,125,129,155,269` etc.). Swap trusted-state logic in `metadata.tsx` per the interface above. Update `hydrateInboxLayout` — it keeps only the missing-snippet queueing. Commit: `refactor(chat): inbox rows computed from stores, delete rows-state cache`.
- [ ] **Step 4: sweep.** `rg -n "rows-state|InboxRow(Big|Small)|syncInboxRow" chat/ constants/` — no stale imports. `yarn jest chat stores`, lint, tsc. Fix `engine.test.tsx`/`metadata.test.tsx` fallout. Commit with step 3 if small.

Perf note for executor: row hooks run per store update per mounted row; all selector bodies must be cheap map lookups; the merge lives in `useMemo`. Do not create new arrays/objects inside the zustand selector itself (breaks referential equality) — only inside `useMemo`.

---

### Task 6: Split thread-context.tsx

Pure file reorganization after Tasks 3–4 shrink it. No behavior change, no export renames.

**Files:**
- Create: `shared/chat/conversation/thread-engine.tsx` — the `apply*ToThread` free functions (`applyMessagesUpdatedToThread`, `applyIncomingMutationToThread`, `applyIncomingMessageToThread`, `applyFailedMessageToThread`, `applyReactionUpdateToThread`, `applyExpungeToThread`, `applyEphemeralPurgeToThread`) + a `useThreadEngineListeners(id: T.Chat.ConversationIDKey, threadActions: ConversationThreadActions): void` hook containing every `useEngineActionListener` currently in `ConversationThreadProviderInner` (thread-context.tsx:1638-1892 minus ones deleted in Task 4).
- Create: `shared/chat/conversation/thread-load.tsx` — `loadConversationThreadMessages`, `scrollDirectionToPagination`, `numMessagesOnInitialLoad`/`numMessagesOnScrollback`, `getClientPrevFromSnapshot`, snapshot helpers (`getLastOrdinalFromSnapshot`, `getOrdinalForMessageIDInSnapshot`), exploding-mode gregor helpers (`getExplodingModeFromGregorItems`, `getExplodingModeFromConfig`, `persistExplodingMode`).
- Modify: `shared/chat/conversation/thread-context.tsx` — keeps: state type, contexts, provider, actions, hooks, `toggleConversationThreadSearch`, `showConversationInfoPanel`. Imports from the two new files. Type exports needed by new files (`ConversationThreadState`, `ConversationThreadActions`, `LoadMoreMessagesParams`, `ThreadLoadStatusOptions`, `ScrollDirection`) get exported from thread-context (some already are).

- [ ] **Step 1: Move code** (cut/paste, adjust imports, export the types the new modules need). Watch the circular import: thread-load/thread-engine import types from thread-context; thread-context imports functions from them — type-only imports one way (`import type`) keep the cycle harmless, but if lint's import-cycle rule fires, move the shared types into `thread-context-types.ts` instead.
- [ ] **Step 2: Also remove the `threadActionsHolder` indirection** (`:1552-1623`): now that `loadConversationThreadMessages` lives in thread-load.tsx and takes `actions` as a param, build the actions object first with a plain `loadMoreMessages` stub assignment:

```ts
const [threadActions] = React.useState<ConversationThreadActions>(() => {
  const impl = (p: LoadMoreMessagesParams) => loadConversationThreadMessages(id, p, threadActions)
  const throttled = throttle(impl, 500)
  const loadMoreMessages: LoadMoreMessages = Object.assign((p: LoadMoreMessagesParams) => {
    if (p.centeredMessageID || p.messageIDControl || p.reason === 'jump to recent') {
      throttled.cancel()
      impl(p)
    } else throttled(p)
  }, {cancel: () => throttled.cancel()})
  const threadActions: ConversationThreadActions = { /* ...same object... */ }
  return threadActions
})
```

(A `const` referenced from a closure created before its initialization is fine at call time — the holder object was equivalent; keep the existing comment about throttle drop semantics.)
- [ ] **Step 3: Validate + commit.** `refactor(chat): split thread-context into engine/load modules`

---

### Task 7: Orange line — keyed store

**Files:**
- Modify: `shared/chat/conversation/orange-line-context.tsx`, `shared/chat/conversation/normal/container.tsx` (NormalOrangeLineProvider consumption), `shared/chat/conversation/data-hooks.tsx:323` (caller unchanged in signature)

**Interfaces:**
- `useExplicitOrangeLineState` becomes `{updates: Map<T.Chat.ConversationIDKey, {ordinal: T.Chat.Ordinal; version: number}>}`; `setOrangeLine` writes into the map; module-level `explicitOrangeLineVersion` counter moves inside the store creator closure (still monotonic). `setConversationOrangeLine` signature unchanged. Consumers that did `s.update?.conversationIDKey === id ? s.update : undefined` become `s.updates.get(id)`.

- [ ] **Step 1: Find consumers** — `rg -n "useExplicitOrangeLineState|OrangeLineContext" chat/` (expect `NormalOrangeLineProvider` in `normal/container.tsx` or nearby). Rewrite store + consumers.
- [ ] **Step 2: Validate + commit.** `refactor(chat): per-conversation orange-line updates map`

---

### Task 8: Merge Focus + Scroll contexts

**Files:**
- Modify: `shared/chat/conversation/normal/context.tsx`, `shared/chat/conversation/normal/container.tsx` (provider tower), all `FocusContext`/`ScrollContext` consumers.

**Interfaces:**
- Produces single `ThreadRefsContext` + `ThreadRefsProvider` exposing `{focusInput, setInputRef, scrollUp, scrollDown, scrollToBottom, setScrollRef}` — one context, one `useState`-stable value, two internal refs. Keep file at `normal/context.tsx`.

- [ ] **Step 1:** `rg -ln "FocusContext|ScrollContext" chat/` → rewrite context file, update provider nesting (two providers become one), mechanical consumer updates (`React.useContext(ThreadRefsContext)`).
- [ ] **Step 2: Validate + commit.** `refactor(chat): merge focus/scroll contexts into ThreadRefsContext`

Leave `MaxInputAreaContext` and `thread-search-overlay-context` alone: different value types with different update cadences (measured number / reanimated SharedValue); merging couples unrelated re-render paths.

---

### Task 9: use-inbox-state username-guard removal

**Files:**
- Modify: `shared/chat/inbox/use-inbox-state.tsx`, plus the inbox screen component that calls it (find via `rg -ln "useInboxState|inboxControls" chat/inbox`).

The `state.username === username ? state.X : default` guards (~lines 82-208) reimplement reset-on-user-switch. Replace with a `key={username}` remount at the inbox screen boundary (component that owns this state), then store plain values in `useState` without embedded username.

- [ ] **Step 1: Read the file + owner component.** Confirm state is component-local (agent report says yes). Apply `key={username}` where the stateful component is rendered; strip username from the state shape and all guards.
- [ ] **Step 2:** If remount at that boundary would drop other wanted state (scroll position across user switch is fine to lose — user switched accounts), proceed; otherwise keep guards and note why in the commit.
- [ ] **Step 3: Validate + commit.** `refactor(chat): inbox controls reset via username key remount`

---

### Task 10: Emoji picker handoff (investigate-first)

**Files:**
- Read first: `shared/chat/emoji-picker/use-picker.tsx` consumers (`rg -ln "usePickerState|updatePickerMap|PickKey"`).

- [ ] **Step 1: Trace the three flows** (`addAlias`, `chatInput`, `reaction`): who opens the picker (route? overlay?), who writes the pick, who consumes + when it's cleared.
- [ ] **Step 2: Decide by precedent.** If the codebase already passes callbacks through navigation params or the picker renders in-tree (overlay/popup, not a separate route), replace the global mailbox with a direct `onPick` callback prop. If the picker is a routed screen and params are serializable-only here, keep the store but make handoff self-cleaning: consumer clears its key on read (`updatePickerMap(key, undefined)` after consumption) and document the mailbox pattern in the file header.
- [ ] **Step 3: Validate + commit.** `refactor(chat): emoji picker pick handoff via callback` (or the self-cleaning variant)

---

### Task 11: Never-reset module state audit

**Files:**
- Modify: `shared/chat/inbox/header-portal-state.tsx`, `shared/chat/blocking/block-buttons-state.tsx`; read `shared/chat/conversation/messages/wrapper/shared-timers.tsx`.

- [ ] **Step 1: header-portal.** Verify the components that call `setInboxHeaderPortalNode/Content` clear on unmount (grep call sites). If they do, module `let`s are effectively lifecycle-managed — leave, add a header comment stating the invariant. If content can survive logout, add an explicit `resetInboxHeaderPortal()` and call it from the same place `Z.resetAllStores` is triggered (`stores/config.tsx:560` area) — read that site first and follow its pattern.
- [ ] **Step 2: block-buttons.** Move `loadGeneration` into the store (plain number field); `loadPromise` stays module-level (promises don't belong in immutable state) but rename to make the pairing with `resetState` obvious and keep the existing manual clear. Confirm `resetState` clears both.
- [ ] **Step 3: shared-timers.** Observers detach on unmount; logout unmounts all rows. No change unless a live timer outlasting logout is observable — read and confirm; comment the invariant.
- [ ] **Step 4: Validate + commit.** `chore(chat): lifecycle-audit module-level chat state`

---

### Task 12: readme rewrite + final validation

**Files:**
- Modify: `shared/chat/readme.md`

- [ ] **Step 1: Rewrite** to describe the post-refactor architecture: per-conversation thread store (messages/ordinals, lifecycle via key remount), inbox metadata store as single meta/participants owner, layout store, badge store, computed row hooks, engine routing, converter layer, ordinal/pending model (keep the existing ordinal section — it's accurate). Note the intentional dualities: live typing (thread store) vs inbox typing snippet; composer draft (input-state) vs service draft (meta).
- [ ] **Step 2: Full validation**

```bash
cd shared && yarn lint && yarn tsc && yarn jest
```

- [ ] **Step 3: Commit.** `docs(chat): update chat readme to current data architecture`
- [ ] **Step 4: STOP. Do not push.** Hand back to user for app verification (desktop + mobile chat smoke: open inbox, unread badges, open conversation, send/edit/delete/react, switch conversations, thread search jump, logout/login).

---

## Explicitly deferred (from the evaluation, with reasons)

- `mergeMessage` hand-rolled deep merge + 4-index consolidation + `messageTypeMap` partial denormalization: highest regression risk per unit of benefit; needs its own test-first plan against `thread-message-state.tsx` once the above has settled.
- typing/draft dual representations: intentional after analysis (live view vs snippet view; local composer vs service draft) — documented in readme instead.
- `ShownUsernameCacheContext` render-time mutation: works, isolated, and a fix requires rethinking sticky-header calculation; separate task if it ever misbehaves.

## Self-review notes

- Task 4 depends on Task 3 (participants first shrinks the diff). Task 5 depends on Task 4 (trusted-state move assumes meta gating in place). Task 6 depends on Tasks 3–4 (file contents). Tasks 1–2 and 7–11 are independent.
- Type consistency: `ConversationThreadState`/`ConversationThreadActions` field removals in Tasks 3–4 are referenced again in Task 6's file split — Task 6 lists only surviving members.
- Riskiest step: `metasReceived` gating change (Task 4 Step 2) — has dedicated tests + force flag for the overwrite paths.
