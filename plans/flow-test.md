# E2E Flow Test Coverage — Page Checklist

Each bucket is a logical group for one or more PRs. Items are ordered easiest-first within each bucket. Validate after each bucket before moving on.

**Pairing rule:** Do Electron and iOS for each bucket together before moving to the next bucket.

**Branch scripts:** `yarn test:e2e:electron:branch` and `yarn test:e2e:ios:branch` run only the new flows being developed. When a flow is verified working on both platforms, remove it from the branch scripts. When adding a new bucket's test files, add them to both scripts.

Out of scope = screens that create, delete, add, invite, or remove something. Everything else is in scope even if it requires app state to reach.

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

- [ ] Encrypt → output screen renders
- [ ] Decrypt → output screen renders (with valid ciphertext)
- [ ] Sign → output screen renders
- [ ] Verify → output screen renders (with valid signed text)

---

## Bucket 3 — Chat: conversation view

Open an existing conversation. No sending.

- [ ] Open first inbox row → message list renders

---

## Bucket 4 — Chat: in-conversation modals

From an open conversation, open each of these. Dismiss/cancel without submitting.

- [ ] Info panel (the ⓘ / conversation info button)
- [ ] Message popup / context menu (long-press or right-click a message)
- [ ] Emoji picker (tap emoji button in input area)
- [ ] Search bots modal (tap bot icon)
- [ ] Bot info / install preview — open a bot, view, don't install (`chatInstallBot`)
- [ ] Bot team picker (`chatInstallBotPick`) — view destinations, cancel
- [ ] Forward message pick (`chatForwardMsgPick`) — view destinations, cancel
- [ ] Attachment fullscreen (`chatAttachmentFullscreen`) — requires a message with an image
- [ ] PDF viewer (`chatPDF`) — requires a message with a PDF
- [ ] Location map popup (`chatUnfurlMapPopup`) — requires a message with a location unfurl
- [ ] External link warning (`chatConfirmNavigateExternal`) — click an http link in a message

---

## Bucket 5 — Settings sub-pages (batch 1)

Navigate from the Settings nav. Confirm renders, go back.

- [ ] About
- [ ] Advanced
- [ ] Display
- [ ] Notifications
- [ ] Feedback
- [ ] Password (modal: `settingsTabs.password`)

---

## Bucket 6 — Settings sub-pages (batch 2)

Same pattern. Devices and Git reuse their main tab screen components.

- [ ] Chat
- [ ] Files
- [ ] Git (reuses git root component)
- [ ] Devices (reuses devices root component)
- [ ] Wallet
- [ ] Archive / Backup
- [ ] Contacts (mobile only, `settingsTabs.contactsTab`)
- [ ] Screen Protector (mobile only, `settingsTabs.screenprotector`)

---

## Bucket 7 — Settings: misc modals

Settings-adjacent modals that are viewable without mutating.

- [ ] Archive modal (`archiveModal`) — view the backup flow, cancel
- [ ] Contacts joined (`settingsContactsJoined`) — notification screen (hard to trigger naturally; may need investigation)
- [ ] Push prompt (`settingsPushPrompt`) — mobile only, view and skip
- [ ] Proxy settings (`proxySettingsModal`) — from the login screen or settings; view and cancel

---

## Bucket 8 — Device detail

From the Devices tab, click a device row.

- [ ] Device detail page renders

---

## Bucket 9 — Team detail tabs

Open a team, navigate each internal tab.

- [ ] Members tab renders
- [ ] Channels tab renders
- [ ] Bots tab renders
- [ ] Settings tab renders (team settings, not app settings)

---

## Bucket 10 — Team sub-screens

From within a team.

- [ ] Team member page (click a member row from Members tab)
- [ ] Edit channel modal — open, cancel (`teamEditChannel`)
- [ ] Team description edit modal — open, cancel (`teamEditTeamDescription`)
- [ ] Team info edit modal — open, cancel (`teamEditTeamInfo`)
- [ ] Invite link join page (`teamInviteLinkJoin`) — view the page, don't join
- [ ] Open team warning modal (`openTeamWarning`) — view and dismiss
- [ ] Retention warning modal (`retentionWarning`) — view and dismiss
- [ ] External team page (`teamExternalTeam`) — view a public/open team without membership

---

## Bucket 11 — Profile page and modals

- [ ] Profile page renders (via People feed item click)
- [ ] Proofs list modal (`profileProofsList`) — open from a profile, view, close
- [ ] Showcase team offer (`profileShowcaseTeamOffer`) — open from own profile, view, cancel

---

## Bucket 12 — Files navigation

From the Files root, tap each TLF type then back.

- [ ] Navigate into `public/` → browser renders
- [ ] Navigate into `private/` → browser renders
- [ ] Navigate into `team/` → browser renders
- [ ] Destination picker (`destinationPicker`) — open move/copy flow, cancel

---

## Bucket 13 — Git

- [ ] Git repo detail (investigate first — clicking a row may open a mutation modal or nothing)
- [ ] Git select channel (`gitSelectChannel`) — open from a repo to set a notification channel, cancel

---

## Bucket 14 — People and account switcher

- [ ] Account switcher modal (People tab → avatar in header)

---

## Bucket 15 — Wallets

- [ ] Wallet root screen renders (`walletsRoot`, accessible via Settings → Wallet)
- [ ] Remove account modal (`removeAccount`) — open, cancel (view-only intent, cancel before submitting)

---

## Out of scope — mutations

These create, delete, add, invite, or remove something. All explicitly listed so nothing is accidentally omitted from evaluation.

**Chat:**
- `chatNewChat` — create new chat / new conversation
- `chatCreateChannel` — create a channel
- `chatAddToChannel` — add members to a channel
- `chatBlockingModal` — block / report / filter a user
- `chatConfirmRemoveBot` — remove a bot from a conversation
- `chatDeleteHistoryWarning` — delete conversation history
- `chatShowNewTeamDialog` — create a new team from a conversation
- `chatSendToChat` — send a file to a chat (FS share flow)
- `chatAttachmentGetTitles` — set titles before sending attachments
- `chatLocationPreview` — send your location (input side, not unfurl view)

**Crypto:**
- `cryptoTeamBuilder` — pick recipients for encrypt (team builder modal)

**Devices:**
- `deviceRevoke` — revoke a device
- `deviceAdd` — add a new device
- `devicePaperKey` — paper key display (only shown during provisioning)
- All provision sub-routes — device provisioning flow

**Files:**
- `confirmDelete` — delete a file/folder

**Git:**
- `gitNewRepo` — create a new git repo
- `gitDeleteRepo` — delete a git repo

**Login/signup/recover:**
- All `login`, `signup*`, `recoverPassword*`, `reset*` routes — not relevant while logged in
- `recoverPasswordSetPassword` — set a new password
- `proxySettingsModal` moved to Bucket 7 (view + cancel is fine)

**People:**
- `peopleTeamBuilder` — the team builder launched from People (adds people to something)

**Profile:**
- `profileEdit` — edit your own profile bio/location
- `profileEditAvatar` — change avatar
- `profileImport` — import a PGP key
- `profilePgp` — start a PGP proof flow
- `profileProveWebsiteChoice` — start a website proof
- `profileRevoke` — revoke a proof
- `profileAddToTeam` — add the viewed user to one of your teams

**Settings:**
- `settingsAddEmail` — add an email address
- `settingsAddPhone` — add a phone number
- `settingsDeleteAddress` — delete an email or phone
- `settingsVerifyPhone` — verify a phone number
- `settingsLogOutTab` — log out
- `checkPassphraseBeforeDeleteAccount` — step in account deletion
- `deleteConfirm` — delete account

**Teams:**
- `teamNewTeamDialog` — create a team
- `teamsTeamBuilder` — add members to a team
- `teamAddEmoji` — add a custom emoji
- `teamAddEmojiAlias` — add an emoji alias
- `teamAddToChannels` — add a user to channels
- `teamAddToTeamFromWhere` / `teamAddToTeamConfirm` / `teamAddToTeamContacts` / `teamAddToTeamEmail` / `teamAddToTeamPhone` — add members wizard
- `teamCreateChannels` — create channels
- `teamDeleteChannel` — delete a channel
- `teamDeleteTeam` — delete a team
- `teamInviteByContact` — invite via contacts
- `teamInviteByEmail` — invite via email
- `teamJoinTeamDialog` — join a team (adds self)
- `teamReallyLeaveTeam` — leave a team
- `teamReallyRemoveChannelMember` — remove someone from a channel
- `teamReallyRemoveMember` — kick a member
- `teamRename` — rename a subteam
- `teamWizard1TeamPurpose` / `teamWizard2TeamInfo` / `teamWizard4TeamSize` / `teamWizard5Channels` / `teamWizard6Subteams` / `teamWizardSubteamMembers` — new team creation wizard

**Wallets:**
- `reallyRemoveAccount` — confirm removal of a wallet account

**Incoming share:**
- `incomingShareNew` — triggered by the OS share sheet; not reachable from within the app
