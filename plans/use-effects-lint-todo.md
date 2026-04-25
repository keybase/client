# React Effect Lint TODO

Source log: `/Users/ChrisNojima/Downloads/temp.log`.

Scope: only `react-hooks/set-state-in-effect` findings. Ignore `refs`, `immutability`, `purity`, `preserve-manual-memoization`, and TypeScript diagnostics unless they are directly touched by a set-state-in-effect fix.

## Batch Rules

- Before starting each batch, read `skill/react-effect-lints/SKILL.md` and use its workflow.
- For each lint, classify the effect first: derived render data, initial state only, identity reset, partial state adjustment, user-event consequence, or external sync/async request.
- Do not fix these by deferring the state update with `setTimeout`, `Promise.resolve`, `queueMicrotask`, `deferEffectUpdate`, or a similar wrapper.
- Do not trade a `react-hooks/set-state-in-effect` fix for another React lint violation. Avoid mutating refs during render, doing side effects during render, adding unguarded render-time `setState`, breaking hook dependency rules, or silencing React lint rules.
- Preserve behavior, guards, platform branches, route params, waiting keys, and stale async protection.
- Remove unused state, refs, imports, helpers, and comments after each item.
- After each batch, update this checklist in the same change.
- On this machine, do not run `yarn`, `npm`, `yarn lint`, or `yarn tsc` because `node_modules` is unavailable. Use pure code review plus `git diff --check`. If working on a machine where repo node tooling is available and allowed, run the focused lint/type checks for the touched files.

## Batch 1: Chat Info Panel

- [x] `shared/chat/conversation/info-panel/attachments.tsx:453:7` - already handled with `skill/react-effect-lints`; moved attachment-view load into `onAttachmentViewChange` and removed `lastSAV`.
- [x] `shared/chat/conversation/info-panel/index.tsx:55:5` - moved the prop tab correction to a guarded render update so the prop-provided tab still wins without an effect.
- [x] `shared/chat/conversation/info-panel/members.tsx:56:7` - replaced last-team-name state with a ref that gates the refresh RPC.

## Batch 2: Chat Modals And Bot Install

- [x] `shared/chat/blocking/block-modal.tsx:244:7` - moved default block settings into state initializers and left the effect for the one-time external block-state refresh.
- [x] `shared/chat/conversation/attachment-get-titles.tsx:122:5` - already absent in current source; the logged `kbfsPreviewURL` reset effect is no longer present.
- [x] `shared/chat/conversation/bot/install.tsx:68:5` - derived the visible conversation ID from the input conversation or a team-tagged async lookup result.
- [x] `shared/chat/conversation/bot/install.tsx:242:5` - tagged loaded bot public commands by username instead of clearing command state in an effect.

## Batch 3: Chat Input And Inbox State

- [x] `shared/chat/conversation/input-area/normal/index.tsx:264:5` - derived exploding-mode seconds directly from conversation state instead of mirroring it in local state.
- [x] `shared/chat/conversation/input-area/normal/input.native.tsx:233:5` - replaced the emoji picker repeat guard state with an effect-local ref.
- [x] `shared/chat/inbox/use-inbox-state.tsx:45:5` - keyed small-row and expansion state by username so username changes render defaults without a reset effect.
- [x] `shared/chat/user-emoji.tsx:34:7` - tagged emoji request completion and derived loading instead of synchronously clearing loading in the effect.

## Batch 4: Chat Message Wrappers And Timers

- [x] `shared/chat/conversation/list-area/index.desktop.tsx:662:9` - preserved waypoint virtualization height with a guarded ref-callback state update instead of state set from an effect.
- [x] `shared/chat/conversation/messages/wrapper/exploding-height-retainer/index.desktop.tsx:20:7` - derived the active burn animation from retained-message state and left the effect only to finish the timer.
- [x] `shared/chat/conversation/messages/wrapper/exploding-height-retainer/index.native.tsx:135:7` - moved random emoji child creation into the animated listener path instead of a render-data effect.
- [x] `shared/chat/conversation/messages/wrapper/exploding-meta.tsx:82:7` - initialized countdown state from keyed message/pending inputs instead of starting it in an effect.
- [x] `shared/chat/conversation/messages/wrapper/exploding-meta.tsx:105:9` - keyed pending transitions so countdown state restarts without a pending-change reset effect.
- [x] `shared/chat/conversation/messages/wrapper/send-indicator.tsx:86:7` - derived status from props plus local timer state and kept effects for the encrypting/sent timers only.

## Batch 5: Chat Conversation Container And Search

- [x] `shared/chat/conversation/normal/container.tsx:40:5` - keyed orange-line state by conversation and let the load effect fetch without synchronously resetting state.
- [x] `shared/chat/conversation/normal/container.tsx:79:9` - folded mobile app-state clearing into the guarded orange-line state adjustment during render.
- [x] `shared/chat/conversation/search.tsx:254:5` - keyed thread-search internals by conversation/query instead of clearing search state in an effect.
- [x] `shared/chat/conversation/search.tsx:264:5` - seeded initial-query state on mount and started the request without syncing input state from an effect.
- [x] `shared/chat/conversation/team-hooks.tsx:290:10` - split team-member effect loading from manual reload loading state and derived initial loading for stale team IDs.
- [x] `shared/chat/conversation/team-hooks.tsx:373:10` - split team-name effect loading from manual reload loading state and keyed visible results by the requested team IDs.

## Batch 6: Common Adapter Components

- [x] `shared/common-adapters/choice-list.native.tsx:16:5` - keyed the active press state by the current options array so option changes render with no active item without an effect reset.
- [x] `shared/common-adapters/copy-text.tsx:97:11` - moved copy-after-load into the copy request callback path and kept toast hiding as a timer effect.
- [x] `shared/common-adapters/phone-input.tsx:198:7` - derived the country picker selected value from the latest selected prop plus local picker edits instead of syncing it in an effect.
- [x] `shared/common-adapters/phone-input.tsx:388:7` - converted the late default-country initialization to a guarded render state adjustment.
- [x] `shared/common-adapters/popup/floating-box/index.desktop.tsx:18:5` - moved anchor measurement out of an effect and into the floating-box commit ref path.
- [x] `shared/common-adapters/popup/floating-box/relative-floating-box.desktop.tsx:284:7` - derived popup style from measured popup/anchor rects collected by the popup ref callback.
- [x] `shared/common-adapters/save-indicator.tsx:35:9` - moved saving-state transitions into a guarded render update and left only the saved-state timeout effect.
- [x] `shared/common-adapters/toast.native.tsx:33:7` - derived render visibility from the visible prop plus delayed hide state and kept animation/timer effects free of synchronous show updates.
- [x] `shared/common-adapters/zoomable-image.desktop.tsx:46:7` - set zoom toast visibility from the zoom click path and left the effect only to expire the toast timer.

## Batch 7: Desktop And Remote Surfaces

- [x] `shared/desktop/remote/remote-component.desktop.tsx:41:5` - keyed received remote props by component/param and used a guarded render reset instead of clearing props in the subscription effect.
- [x] `shared/menubar/remote-proxy.desktop.tsx:281:7` - moved logout/user-switch TLF clearing into guarded render state while the effect only invalidates pending loads and starts enabled refreshes.
- [x] `shared/pinentry/remote-proxy.desktop.tsx:78:7` - moved popup hiding on logout into a guarded render reset and left the effect to clear remote action handlers only.

## Batch 8: Files, Devices, Git, Incoming Share, Wallets

- [x] `shared/devices/device-revoke.tsx:144:5` - derived the visible device from props or a matching loaded device instead of mirroring `ownProps.device`.
- [x] `shared/fs/browser/rows/editing.tsx:27:5` - removed filename mirror state and writes edits directly through `editSession.setEditName`.
- [x] `shared/fs/common/hooks.tsx:884:7` - kept known-path version invalidation but derives known path info instead of synchronously resetting cache state.
- [x] `shared/fs/common/hooks.tsx:1040:7` - kept non-file version invalidation and derives empty file context for non-file/stale keys.
- [x] `shared/fs/common/use-files-tab-upload-icon.tsx:63:7` - invalidates pending badge loads on disconnect and derives the disconnected icon as `undefined`.
- [x] `shared/fs/footer/upload.desktop.tsx:18:7` - derives upload draw state from `showing` plus delayed hide completion, leaving the effect to own the hide timer.
- [x] `shared/fs/footer/use-upload-countdown.tsx:72:11` - moved countdown state transitions into a guarded render state machine and left the effect to own the interval.
- [x] `shared/git/index.tsx:141:5` - replaced route-param expansion effect/ref with guarded route-key expansion state.
- [x] `shared/incoming-share/index.tsx:309:5` - derives Android share items from `androidShare` instead of syncing local state.
- [x] `shared/wallets/really-remove-account.tsx:33:5` - keys the loaded secret key by `accountID` and protects stale async callbacks instead of clearing in the effect.

## Batch 9: Login, Profile, Provision

- [x] `shared/login/relogin/container.tsx:68:5` - replaced default-user sync with a guarded reset keyed by the selected default username.
- [x] `shared/login/relogin/container.tsx:73:7` - replaced the need-password error latch effect with a guarded same-component state update.
- [x] `shared/profile/add-to-team.tsx:181:5` - keyed the inner add-to-team component by username so username changes reset local form state before loading.
- [x] `shared/profile/generic/proofs-list.tsx:680:5` - replaced initial-username sync with guarded username state.
- [x] `shared/profile/generic/proofs-list.tsx:684:5` - replaced error prop sync with guarded error state while preserving submit-cleared local errors.
- [x] `shared/profile/generic/proofs-list.tsx:761:5` - replaced generic step username sync with guarded username state.
- [x] `shared/profile/use-proof-suggestions.tsx:100:5` - keys proof-suggestion results by enabled/load state and hides disabled or stale results without a clearing effect.
- [x] `shared/provision/code-page/container.tsx:71:5` - replaced default-tab sync with guarded tab state.

## Batch 10: Settings And Signup

- [x] `shared/router-v2/account-switcher/index.tsx:142:7` - resets clicked row state with a guarded waiting-key adjustment.
- [x] `shared/settings/account/index.tsx:208:5` - consumes added-email route banner state during guarded render while the effect only clears route params.
- [x] `shared/settings/account/index.tsx:215:5` - consumes added-phone route banner state during guarded render while the effect only clears route params.
- [x] `shared/settings/account/index.tsx:222:5` - clears account banner state with a guarded focus-keyed render adjustment.
- [x] `shared/settings/account/index.tsx:231:7` - derives invalid or verified added-email banner clearing during render.
- [x] `shared/settings/chat.tsx:199:7` - seeds selected team notification settings with a guarded render update.
- [x] `shared/settings/files/hooks.tsx:38:21` - keeps file-settings loading state for explicit refreshes while the initial effect starts the request without a synchronous loading update.
- [x] `shared/settings/proxy.tsx:123:9` - keys proxy form state to loaded `proxyData` via guarded render adjustment.
- [x] `shared/signup/device-name.tsx:139:7` - sanitizes the device name in the initializer and input handler instead of an effect.

## Batch 11: Teams Entry Forms And Permissions

- [x] `shared/teams/add-members-wizard/confirm.tsx:49:5` - replaced wizard mirror state with guarded render adjustment keyed by the incoming wizard.
- [x] `shared/teams/add-members-wizard/confirm.tsx:301:5` - removed redundant role mirror state and derives from the wizard role.
- [x] `shared/teams/channel/create-channels.tsx:21:5` - keyed an inner component by `teamID` for identity resets.
- [x] `shared/teams/channel/header.tsx:15:5` - tags recent-joins results by `conversationIDKey` with stale callback cleanup.
- [x] `shared/teams/common/enable-contacts.tsx:16:5` - derives popup visibility from `noAccess` plus local dismissal state.
- [x] `shared/teams/common/use-contacts.native.tsx:93:7` - tags contact load state by permission/region key and derives visible loading/error state.
- [x] `shared/teams/common/use-contacts.native.tsx:123:7` - derives permanent no-access state from permission status instead of writing local state.
- [x] `shared/teams/emojis/add-alias.tsx:47:26` - seeds and guards alias selection from `defaultSelected` while keeping focus as the only effect.

## Batch 12: Teams Loading And Navigation

- [x] `shared/teams/external-team.tsx:22:5` - tags team-info results by teamname and request ID, deriving waiting from the matching result.
- [x] `shared/teams/join-team/container.tsx:45:5` - keyed an inner join-team component by `initialTeamname`.
- [x] `shared/teams/join-team/join-from-invite.tsx:45:5` - keyed an inner invite component by invite identity.
- [x] `shared/teams/new-team/wizard/new-team-info.tsx:65:7` - tags debounced team-name validation results by teamname and derives stale or too-short names as available.
- [x] `shared/teams/role-picker.tsx:270:5` - uses a guarded render reset for `presetRole`.
- [x] `shared/teams/team/index.tsx:103:5` - scopes team-local collapsed/filter state by `teamID`.
- [x] `shared/teams/team/member/index.new.tsx:109:5` - tags team-tree membership state by team/user and splits explicit reload from initial load.
- [x] `shared/teams/team/rows/index.tsx:294:5` - tags general-conversation lookup results by `teamID` and preserves request stale guards.
- [x] `shared/teams/team/rows/index.tsx:365:7` - removes trigger mirror state and loads emoji directly from the trigger effect.

## Batch 13: Teams Settings And Cached Resource

- [x] `shared/teams/team/settings-tab/default-channels.tsx:67:19` - starts the initial default-channel load without a synchronous waiting update while preserving request/team guards.
- [x] `shared/teams/team/settings-tab/index.tsx:439:5` - replaces reset key state/effect with a derived settings key.
- [x] `shared/teams/team/settings-tab/retention/index.tsx:63:7` - removes modal-open mirror state and reset effect.
- [x] `shared/teams/team/settings-tab/retention/index.tsx:105:11` - moves retention warning/save logic into the menu selection handler.
- [x] `shared/teams/team/settings-tab/retention/index.tsx:118:9` - derives saving state from pending policy instead of policy-change effect writes.
- [x] `shared/teams/team/settings-tab/retention/index.tsx:475:10` - inlines initial retention loading as a cancellable async effect with request-version stale protection.
- [x] `shared/teams/team/team-info.tsx:75:5` - tags draft team name by source name and derives resets when the source changes.
- [x] `shared/teams/team/team-info.tsx:79:5` - tags draft description by source description and derives resets when the source changes.
- [x] `shared/teams/use-cached-resource.tsx:146:5` - derives visible cache state for key/cache/enabled mismatches instead of synchronously resetting from the prop-change effect.

## Batch 14: Utilities And App Global Error

- [x] `shared/app/global-errors.tsx:76:5` - derives size from the current error plus expanded-error state and clears the expanded marker when the error is gone.
- [x] `shared/util/featured-bots.tsx:41:7` - keys featured-bot results by username with cancellation instead of clearing on empty username.
- [x] `shared/util/featured-bots.tsx:91:7` - drives featured-bot page loads from pending-page state and settles async results with cancellation guards.
- [x] `shared/util/phone-numbers/index.tsx:236:7` - initializes from the cached default country and lets the async loader update without a synchronous cache set in the effect.
- [x] `shared/util/use-intersection-observer.desktop.tsx:44:5` - creates and subscribes the observer directly in the layout effect instead of mirroring observer state.
