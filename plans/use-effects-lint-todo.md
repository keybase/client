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

- [ ] `shared/chat/conversation/input-area/normal/index.tsx:264:5`
- [ ] `shared/chat/conversation/input-area/normal/input.native.tsx:233:5`
- [ ] `shared/chat/inbox/use-inbox-state.tsx:45:5`
- [ ] `shared/chat/user-emoji.tsx:34:7`

## Batch 4: Chat Message Wrappers And Timers

- [x] `shared/chat/conversation/list-area/index.desktop.tsx:662:9` - preserved waypoint virtualization height with a measured-height ref instead of state set from an effect.
- [ ] `shared/chat/conversation/messages/wrapper/exploding-height-retainer/index.desktop.tsx:20:7`
- [ ] `shared/chat/conversation/messages/wrapper/exploding-height-retainer/index.native.tsx:135:7`
- [ ] `shared/chat/conversation/messages/wrapper/exploding-meta.tsx:82:7`
- [ ] `shared/chat/conversation/messages/wrapper/exploding-meta.tsx:105:9`
- [ ] `shared/chat/conversation/messages/wrapper/send-indicator.tsx:86:7`

## Batch 5: Chat Conversation Container And Search

- [ ] `shared/chat/conversation/normal/container.tsx:40:5`
- [ ] `shared/chat/conversation/normal/container.tsx:79:9`
- [ ] `shared/chat/conversation/search.tsx:254:5`
- [ ] `shared/chat/conversation/search.tsx:264:5`
- [ ] `shared/chat/conversation/team-hooks.tsx:290:10`
- [ ] `shared/chat/conversation/team-hooks.tsx:373:10`

## Batch 6: Common Adapter Components

- [ ] `shared/common-adapters/choice-list.native.tsx:16:5`
- [ ] `shared/common-adapters/copy-text.tsx:97:11`
- [ ] `shared/common-adapters/phone-input.tsx:198:7`
- [ ] `shared/common-adapters/phone-input.tsx:388:7`
- [ ] `shared/common-adapters/popup/floating-box/index.desktop.tsx:18:5`
- [ ] `shared/common-adapters/popup/floating-box/relative-floating-box.desktop.tsx:284:7`
- [ ] `shared/common-adapters/save-indicator.tsx:35:9`
- [ ] `shared/common-adapters/toast.native.tsx:33:7`
- [ ] `shared/common-adapters/zoomable-image.desktop.tsx:46:7`

## Batch 7: Desktop And Remote Surfaces

- [ ] `shared/desktop/remote/remote-component.desktop.tsx:41:5`
- [ ] `shared/menubar/remote-proxy.desktop.tsx:281:7`
- [ ] `shared/pinentry/remote-proxy.desktop.tsx:78:7`

## Batch 8: Files, Devices, Git, Incoming Share, Wallets

- [ ] `shared/devices/device-revoke.tsx:144:5`
- [ ] `shared/fs/browser/rows/editing.tsx:27:5`
- [ ] `shared/fs/common/hooks.tsx:884:7`
- [ ] `shared/fs/common/hooks.tsx:1040:7`
- [ ] `shared/fs/common/use-files-tab-upload-icon.tsx:63:7`
- [ ] `shared/fs/footer/upload.desktop.tsx:18:7`
- [ ] `shared/fs/footer/use-upload-countdown.tsx:72:11`
- [ ] `shared/git/index.tsx:141:5`
- [ ] `shared/incoming-share/index.tsx:309:5`
- [ ] `shared/wallets/really-remove-account.tsx:33:5`

## Batch 9: Login, Profile, Provision

- [ ] `shared/login/relogin/container.tsx:68:5`
- [ ] `shared/login/relogin/container.tsx:73:7`
- [ ] `shared/profile/add-to-team.tsx:181:5`
- [ ] `shared/profile/generic/proofs-list.tsx:680:5`
- [ ] `shared/profile/generic/proofs-list.tsx:684:5`
- [ ] `shared/profile/generic/proofs-list.tsx:761:5`
- [ ] `shared/profile/use-proof-suggestions.tsx:100:5`
- [ ] `shared/provision/code-page/container.tsx:71:5`

## Batch 10: Settings And Signup

- [ ] `shared/router-v2/account-switcher/index.tsx:142:7`
- [ ] `shared/settings/account/index.tsx:208:5`
- [ ] `shared/settings/account/index.tsx:215:5`
- [ ] `shared/settings/account/index.tsx:222:5`
- [ ] `shared/settings/account/index.tsx:231:7`
- [ ] `shared/settings/chat.tsx:199:7`
- [ ] `shared/settings/files/hooks.tsx:38:21`
- [ ] `shared/settings/proxy.tsx:123:9`
- [ ] `shared/signup/device-name.tsx:139:7`

## Batch 11: Teams Entry Forms And Permissions

- [ ] `shared/teams/add-members-wizard/confirm.tsx:49:5`
- [ ] `shared/teams/add-members-wizard/confirm.tsx:301:5`
- [ ] `shared/teams/channel/create-channels.tsx:21:5`
- [ ] `shared/teams/channel/header.tsx:15:5`
- [ ] `shared/teams/common/enable-contacts.tsx:16:5`
- [ ] `shared/teams/common/use-contacts.native.tsx:93:7`
- [ ] `shared/teams/common/use-contacts.native.tsx:123:7`
- [ ] `shared/teams/emojis/add-alias.tsx:47:26`

## Batch 12: Teams Loading And Navigation

- [ ] `shared/teams/external-team.tsx:22:5`
- [ ] `shared/teams/join-team/container.tsx:45:5`
- [ ] `shared/teams/join-team/join-from-invite.tsx:45:5`
- [ ] `shared/teams/new-team/wizard/new-team-info.tsx:65:7`
- [ ] `shared/teams/role-picker.tsx:270:5`
- [ ] `shared/teams/team/index.tsx:103:5`
- [ ] `shared/teams/team/member/index.new.tsx:109:5`
- [ ] `shared/teams/team/rows/index.tsx:294:5`
- [ ] `shared/teams/team/rows/index.tsx:365:7`

## Batch 13: Teams Settings And Cached Resource

- [ ] `shared/teams/team/settings-tab/default-channels.tsx:67:19`
- [ ] `shared/teams/team/settings-tab/index.tsx:439:5`
- [ ] `shared/teams/team/settings-tab/retention/index.tsx:63:7`
- [ ] `shared/teams/team/settings-tab/retention/index.tsx:105:11`
- [ ] `shared/teams/team/settings-tab/retention/index.tsx:118:9`
- [ ] `shared/teams/team/settings-tab/retention/index.tsx:475:10`
- [ ] `shared/teams/team/team-info.tsx:75:5`
- [ ] `shared/teams/team/team-info.tsx:79:5`
- [ ] `shared/teams/use-cached-resource.tsx:146:5`

## Batch 14: Utilities And App Global Error

- [ ] `shared/app/global-errors.tsx:76:5`
- [ ] `shared/util/featured-bots.tsx:41:7`
- [ ] `shared/util/featured-bots.tsx:91:7`
- [ ] `shared/util/phone-numbers/index.tsx:236:7`
- [ ] `shared/util/use-intersection-observer.desktop.tsx:44:5`
