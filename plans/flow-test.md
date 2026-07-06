# E2E Flow Test Coverage — Page Checklist

**Skill:** Use the `keybase-e2e-tests` skill for testID conventions, Playwright gotchas, Maestro command patterns, and iOS navigation structure.

Each bucket is a logical group for one or more PRs. Items are ordered easiest-first within each bucket. Validate after each bucket before moving on.

**Pairing rule:** Buckets 1–15: do Electron and iOS together. Buckets 16+ (visual-coverage expansion): Electron first; iOS gets a follow-up pass once the desktop suite is stable.

**Branch scripts:** `yarn test:e2e:desktop:branch` and `yarn test:e2e:ios:branch` run only the new flows being developed. When a flow is verified working on both platforms, remove it from the branch scripts. When adding a new bucket's test files, add them to both scripts.

**Goal:** 100% visual coverage of the app. Every test's final screenshot is a visual-regression baseline (playwright `screenshot: 'on'` + `yarn test:e2e:desktop:save-baseline`), and the dark-mode project doubles every shot for free. So coverage = one test per distinct visual state: routes, modals, popups, scroll positions, filled inputs.

**Mutations are now IN SCOPE** when the flow is reproducible:
- **Create → cleanup in the same test.** A test that creates something must delete it before it ends (git repo, channel, email address, paper key). Use fixed `e2e-vis-*` names and delete any leftover at test start so a crashed run self-heals.
- **Open → cancel is always fine.** Any modal/wizard can be opened and screenshotted as long as the test cancels before the final submit when the mutation isn't cleanly reversible.
- **Never touch:** account deletion/reset, revoking a real device (paper keys created by the test are OK), logging out, changing the password, verifying a phone number, creating/revoking real proofs, leaving or deleting real teams, blocking real users. See the Forbidden list at the bottom.
- Avoid visual nondeterminism: created objects use fixed names, message sends go to a dedicated e2e conversation (accept that its history grows — screenshot the input/modal states, not the message list).

**testID rule:** Never wrap existing component content in a new `Kb.Box2` (or any container) just to attach a `testID`. Instead, add the `testID` prop directly to an element that already exists in the component — an input, a scroll view, a pre-existing wrapper, etc.

---

## Bucket 1 — Crypto sub-tabs (inputs)

Navigate to each sub-tab in the Crypto section.

- [x] Encrypt input renders
- [x] Decrypt input renders
- [x] Sign input renders
- [x] Verify input renders

---

## Bucket 2 — Crypto outputs

Type something in each sub-tab and run it to see the output screen. Local-only operation, no server mutation.

- [x] Encrypt → output screen renders (Electron ✓, iOS written)
- [x] Decrypt → output screen renders — encrypt first, feed ciphertext to decrypt (Electron ✓, iOS: needs clipboard support, skipped)
- [x] Sign → output screen renders (Electron ✓, iOS written)
- [x] Verify → output screen renders — sign first, feed signed text to verify (Electron ✓, iOS: needs clipboard support, skipped)

---

## Bucket 3 — Chat: conversation view

Open an existing conversation. No sending.

- [x] Open first inbox row → message list renders (Electron ✓, iOS written)
- [x] Chat input visible in open conversation (Electron ✓, iOS: chat-send-message.yaml already covers this)
- [x] Return to inbox from conversation (Electron ✓, iOS written)

---

## Bucket 4 — Chat: in-conversation modals

From an open conversation, open each of these. Dismiss/cancel without submitting.

- [x] Info panel (the ⓘ / conversation info button) (Electron ✓ chat-modals.test.ts)
- [x] Message popup / context menu (long-press or right-click a message) (Electron ✓)
- [x] Emoji picker (tap emoji button in input area) (Electron ✓)
- [x] Search bots modal (info panel → Bots → Add a bot) (Electron ✓)
- [x] Bot info / install preview — open a bot, view, don't install (`chatInstallBot`) (Electron ✓)
- [ ] Bot team picker (`chatInstallBotPick`) — view destinations, cancel
- [x] Forward message pick (`chatForwardMsgPick`) — view destinations, cancel (Electron ✓)
- [x] Attachment fullscreen (`chatAttachmentFullscreen`) — requires a message with an image (Electron ✓)
- [ ] PDF viewer (`chatPDF`) — requires a seeded PDF message
- [ ] Location map popup (`chatUnfurlMapPopup`) — requires a message with a location unfurl
- [ ] External link warning (`chatConfirmNavigateExternal`) — click an http link in a message (seed via send)

---

## Bucket 5 — Settings sub-pages (batch 1)

Navigate from the Settings nav. Confirm renders, go back.

- [x] About (Electron ✓, iOS written)
- [x] Advanced (Electron ✓, iOS written)
- [x] Display (Electron ✓, iOS written)
- [x] Notifications (Electron ✓, iOS written)
- [x] Feedback (Electron ✓, iOS written)
- [x] Password (modal: `settingsTabs.password`) (Electron ✓ misc-modals.test.ts)

---

## Bucket 6 — Settings sub-pages (batch 2)

Same pattern. Devices and Git reuse their main tab screen components.

- [x] Chat (Electron ✓, iOS written via settings-subpages.yaml)
- [x] Files (Electron ✓, iOS written via settings-subpages.yaml)
- [x] Git — reuses git root component (Electron ✓, iOS ✓ via git.yaml)
- [x] Devices — reuses devices root component (Electron ✓, iOS ✓ via devices-view.yaml)
- [x] Wallet (Electron ✓ misc-modals.test.ts)
- [x] Archive / Backup (Electron ✓, iOS written via settings-subpages.yaml)
- [ ] Contacts (mobile only, `settingsTabs.contactsTab`)
- [x] Screen Protector (mobile only, `settingsTabs.screenprotector`) (Electron ✓, iOS: Android only)

---

## Bucket 7 — Settings: misc modals

Settings-adjacent modals that are viewable without mutating.

- [x] Archive modal (`archiveModal`) — view the backup flow, cancel (Electron ✓ misc-modals.test.ts)
- [ ] Contacts joined (`settingsContactsJoined`) — notification screen (hard to trigger naturally; may need investigation)
- [ ] Push prompt (`settingsPushPrompt`) — mobile only, view and skip
- [ ] Proxy settings (`proxySettingsModal`) — from the login screen or settings; view and cancel

---

## Bucket 8 — Device detail

From the Devices tab, click a device row.

- [x] Device detail page renders (Electron ✓, iOS written)

---

## Bucket 9 — Team detail tabs

Open a team, navigate each internal tab.

- [x] Members tab renders (Electron ✓, iOS written)
- [x] Channels tab renders — conditional on big team/admin (Electron ✓, iOS written)
- [x] Bots tab renders (Electron ✓, iOS written)
- [x] Settings tab renders (Electron ✓, iOS written)

---

## Bucket 10 — Team sub-screens

From within a team.

- [x] Team member page (Electron ✓, iOS written) — taps smoke user's username in member list
- [x] Edit channel modal — open, cancel (`teamEditChannel`) (Electron ✓ teams-modals.test.ts)
- [x] Team description edit modal — open, cancel (`teamEditTeamDescription`) (Electron ✓ teams-modals.test.ts)
- [x] Team info edit modal — open, cancel (`teamEditTeamInfo`) (Electron ✓ teams-modals.test.ts)
- [ ] Invite link join page (`teamInviteLinkJoin`) — view the page, don't join
- [ ] Open team warning modal (`openTeamWarning`) — view and dismiss
- [x] Retention warning modal (`retentionWarning`) — view and dismiss (Electron ✓ teams-modals.test.ts)
- [ ] External team page (`teamExternalTeam`) — view a public/open team without membership

---

## Bucket 11 — Profile page and modals

- [x] Profile page renders (Electron ✓ via People tab header; iOS written — conditional on username in feed)
- [x] Proofs list modal (`profileProofsList`) — open from a profile, view, close (Electron ✓ profile-modals.test.ts)
- [ ] Showcase team offer (`profileShowcaseTeamOffer`) — open from own profile, view, cancel

---

## Bucket 12 — Files navigation

From the Files root, tap each TLF type then back.

- [x] Navigate into `public/` → browser renders (Electron ✓, iOS written)
- [x] Navigate into `private/` → browser renders (Electron ✓, iOS written)
- [x] Navigate into `team/` → browser renders (Electron ✓, iOS written)
- [ ] Navigate back to files root from subfolder (Electron ✓, iOS written)
- [ ] Destination picker (`destinationPicker`) — open move/copy flow, cancel

---

## Bucket 13 — Git

- [x] Git repo list renders (Electron ✓, iOS written)
- [x] Git repo row is visible (Electron ✓, iOS written)
- [ ] Git repo detail (investigate first — clicking a row may open a mutation modal or nothing)
- [ ] Git select channel (`gitSelectChannel`) — open from a repo to set a notification channel, cancel

---

## Bucket 14 — People and account switcher

- [x] Account switcher (desktop: "Hi user!" menu in tab bar; mobile: People tab → avatar) (Electron ✓ misc-modals.test.ts)

---

## Bucket 15 — Wallets

- [x] Wallet root screen renders (`walletsRoot`, accessible via Settings → Wallet) (Electron ✓ misc-modals.test.ts)
- ~~Remove account modal (`removeAccount`)~~ — moved to Forbidden per user; don't automate stellar account removal at all

---

## Bucket 16 — Scroll depth and list states (desktop)

Same screen, more of it. Scroll to a deterministic position (bottom, or a fixed element) before the final screenshot.

- [x] Chat inbox scrolled to bottom of conversation list (Electron ✓ scroll-states.test.ts)
- [x] Chat conversation scrolled up into older messages (Electron ✓)
- [x] Settings → Advanced scrolled to bottom (dev/proxy section) (Electron ✓)
- [x] Settings → Notifications scrolled to bottom (Electron ✓ scroll-states.test.ts)
- [x] Team members tab scrolled to bottom of member list (Electron ✓)
- [x] Files TLF list scrolled to bottom (Electron ✓)
- [x] Profile page scrolled to proofs/folders section (Electron ✓)
- [x] People feed scrolled to bottom (Electron ✓)

---

## Bucket 17 — Chat compose states

Distinct visual states of the input area in the dedicated e2e conversation. No sends needed except where noted.

- [x] `@`-mention suggestion popup (type `@` + partial name) (Electron ✓ chat-compose.test.ts)
- [x] Channel-mention popup (type `#` in a team conversation) (Electron ✓ chat-interactions.test.ts)
- [x] Emoji picker open from input bar (Electron ✓ chat-modals.test.ts)
- [x] `/`-command suggestion popup (type `/`) (Electron ✓ chat-compose.test.ts)
- [x] Giphy preview row (type `/giphy something`) (Electron ✓ chat-interactions.test.ts)
- [x] Multiline input grown (type several lines) (Electron ✓ chat-compose.test.ts)
- [x] Edit-message mode (up-arrow on own last message; escape to cancel) (Electron ✓ chat-interactions.test.ts)
- [x] Reply-quote state (reply to a message, input shows quote; escape to cancel) (Electron ✓ chat-interactions.test.ts)

---

## Bucket 18 — Chat message interactions

From the dedicated e2e conversation.

- [x] Message context menu (right-click a text message) (Electron ✓ chat-modals.test.ts)
- [x] Reaction picker (hover toolbar → react) (Electron ✓ chat-interactions.test.ts)
- [ ] Reacji tooltip (hover an existing reaction)
- [x] Info panel members tab / attachments tab / settings tab (Electron ✓ chat-modals + chat-interactions)
- [ ] Attachment fullscreen (`chatAttachmentFullscreen`) — needs a seeded image message
- [ ] PDF viewer (`chatPDF`) — needs a seeded PDF message
- [ ] External link warning (`chatConfirmNavigateExternal`) — click an http link in a seeded message

---

## Bucket 19 — Chat mutations (reproducible)

- [x] `chatNewChat` — open new-conversation team builder, screenshot, cancel (Electron ✓ chat-mutations.test.ts)
- [ ] Send message to dedicated e2e conversation (self-conversation or e2e team channel); history grows — screenshot the send state, not the list
- [x] `chatCreateChannel` — create `e2e-vis-chan` → screenshot → delete channel (`teamDeleteChannel` covered as cleanup) (Electron ✓ team-wizard-channel.test.ts)
- [x] `chatDeleteHistoryWarning` — open, screenshot, cancel (Electron ✓ chat-mutations.test.ts)
- [x] `chatBlockingModal` — open block dialog, screenshot, cancel (never submit) (Electron ✓ chat-mutations.test.ts)
- [ ] `chatAttachmentGetTitles` — attach a file, screenshot the titles modal, cancel
- [ ] `chatShowNewTeamDialog` — open, screenshot, cancel

---

## Bucket 20 — Git mutations (reproducible)

- [x] `gitNewRepo` — new-repo modal screenshot → create `e2e-vis-repo` → repo row renders → `gitDeleteRepo` delete-confirm screenshot → confirm delete (full cycle, self-cleaning) (Electron ✓ git-mutations.test.ts)
- [ ] `gitSelectChannel` — open from a team repo, screenshot, cancel

---

## Bucket 21 — Team modals and wizards (open → cancel)

All in the dedicated e2e team unless noted.

- [x] `teamNewTeamDialog` wizard purpose + name screens, cancel before create (Electron ✓ team-wizard-channel.test.ts); deeper wizard steps (size/channels/subteams) still todo
- [ ] `teamsTeamBuilder` — add-members builder, screenshot, cancel
- [x] `teamAddToTeamFromWhere` wizard first screens + email screen, cancel (Electron ✓ teams-modals.test.ts)
- [ ] `teamInviteByEmail` — screenshot, cancel
- [x] `teamEditChannel` — open, screenshot, cancel (Electron ✓ teams-modals.test.ts)
- [x] `teamEditTeamDescription` / `teamEditTeamInfo` — open, screenshot, cancel (Electron ✓ teams-modals.test.ts)
- [x] `teamAddEmoji` — open, screenshot, cancel (Electron ✓ teams-modals.test.ts); `teamAddEmojiAlias` still todo
- [x] `retentionWarning` — change retention dropdown to trigger, screenshot, cancel (Electron ✓ teams-modals.test.ts)
- [ ] `openTeamWarning` — toggle open-team setting to trigger, screenshot, cancel

---

## Bucket 22 — Settings mutations (reproducible)

- [x] `settingsAddEmail` — add `e2e-vis@example.com` → row renders → `settingsDeleteAddress` delete it (full cycle) (Electron ✓ settings-mutations.test.ts)
- [x] `settingsAddPhone` — open, screenshot, cancel (never verify) (Electron ✓ settings-mutations.test.ts)
- [ ] Password modal (`settingsTabs.password`) — open, screenshot, cancel (never save)
- [x] `settingsLogOutTab` — view the screen only, close modal (never log out) (Electron ✓ settings-mutations.test.ts)
- [ ] `archiveModal` — open, screenshot, cancel

---

## Bucket 23 — Devices mutations (careful)

- [x] `deviceAdd` — add-device chooser, screenshot, cancel (Electron ✓ device-wallet-modals.test.ts); provisioning instruction sub-screens still todo
- [ ] `devicePaperKey` — create a paper key → screenshot display screen → `deviceRevoke` revoke that same paper key (screenshot revoke page) → confirm (full cycle; only ever revoke the key the test created)

---

## Bucket 24 — Profile and people mutations (open → cancel)

- [x] `profileEdit` — open own-profile edit, screenshot, cancel (Electron ✓ profile-modals.test.ts)
- [ ] `profileEditAvatar` — open, screenshot, cancel
- [ ] `peopleTeamBuilder` — open from People, screenshot, cancel
- [ ] `profileAddToTeam` — open on another user's profile, screenshot, cancel
- [x] `cryptoTeamBuilder` — encrypt recipients picker, screenshot, cancel (Electron ✓ device-wallet-modals.test.ts)
- [ ] Proof flows (`profilePgp`, `profileProveWebsiteChoice`) — first screen only, screenshot, cancel (never post a proof)

---

## Bucket 25 — Route audit for 100%

- [ ] Enumerate every route in `shared/router-v2` route maps and cross-check against this file; add missing screens as new checklist items
- [ ] Verify the dark project produces a shot for every light shot in the report

---

## Forbidden — never automate

Not reproducible or account-damaging. Do not add tests for these.

- Account deletion/reset: `deleteConfirm`, `checkPassphraseBeforeDeleteAccount`, `reset*`
- Logging out (`settingsLogOutTab` submit), changing the password (`recoverPasswordSetPassword`, password modal save)
- Revoking any device the test didn't create (paper keys created in Bucket 23 are the only exception)
- Actually creating a team (names are permanent), leaving/deleting real teams, renaming subteams (`teamRename`), kicking members (`teamReallyRemoveMember`, `teamReallyRemoveChannelMember`)
- Blocking/reporting real users (submit side of `chatBlockingModal`), removing bots (`chatConfirmRemoveBot`)
- Verifying a phone number (`settingsVerifyPhone`), posting/revoking real proofs (`profileRevoke`, proof-flow submits), importing PGP keys (`profileImport`)
- Joining teams (`teamJoinTeamDialog`)
- Wallet/stellar account removal — the ENTIRE flow (`removeAccount`, `reallyRemoveAccount`), including open-and-cancel; per user, don't automate anything that deletes stellar accounts
- Files `confirmDelete` on real user data (test-created files OK)
- Login/signup/provision routes — unreachable while logged in
- `incomingShareNew` — OS share sheet only, unreachable
- `chatSendToChat`, `chatLocationPreview` — FS-share / location send paths, mobile/OS-dependent
