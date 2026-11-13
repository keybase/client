// Routes, write RPCs and surfaces the iOS release run does not have to reach, each with why. A reason
// starting `manual-only: <id>` names an entry of IOS_MANUAL_ONLY (manual-only.ts): the run stops at
// that edge and a person does the rest.
import type {Exclusions} from '../../../shared/gate/census-lib.ts'

const desktopOnly = 'desktop only: the phone has no such screen'
// provisioning the signed-in phone as a new device needs a fresh install
const phoneNew = 'manual-only: phone-new-device (the screens that provision this phone as a new device)'
// the signed-out flows stop at "Start account reset" (flows/account-signed-out.test.ts)
const resetStart = 'owner: excluded (account reset start and cancel)'

// the phone's crypto screens take text only: crypto/input.tsx draws the file picker only on desktop
// (`!isMobile && browseButton`), and crypto/output.tsx offers "Save as TXT" only on desktop
const cryptoTextOnly = 'the phone encrypts, decrypts, signs and verifies text only: crypto/input.tsx draws no file picker on mobile and crypto/output.tsx offers no "Save as TXT" there'
// the wallet (stellar payments were dropped from the app; a wallet account is never made by the gate)
const walletRemove = 'needs a stellar wallet account to remove, and removing one cannot be undone; the gate makes none (wallets/index.tsx opens removeAccount, then reallyRemoveAccount)'
// the Backup page's whole-account backups
const backupAll =
  "manual-only: backup-all (a whole-account backup copies every folder and repo of the account onto the phone, non-test teams' too, and the phone's backup status lists only some of the jobs it starts, so they cannot all be proven cancelled and removed)"

// The Backup page offers pause, resume and remove only while a job runs, and the flows back up small
// data that finishes at once (no flow sends large data); settings/archive/index.test.tsx covers what
// each sends, on the real page. A finished job's only removal on the phone is Clear completed,
// which would also remove jobs from before the run.
const backupRunningOnly = 'offered only while a backup job runs; covered by settings/archive/index.test.tsx'

export const IOS_EXCLUSIONS: Exclusions = {
  routes: {
    cryptoRoot:
      "the crypto tab's root, and the phone has no crypto tab (constants/tabs.tsx phoneTabs); More > Crypto opens settingsTabs.cryptoTab, which the crypto flows cover",
    feedback:
      "opened only from error screens: a global error's banner (app/global-errors.tsx), a load failure's Reload screen (common-adapters/reload.tsx), a failed bot install (chat/conversation/bot/install.tsx) and a login that failed to load (login/loading.tsx); the gate makes none. Settings > Feedback (settingsTabs.feedbackTab) is covered by settings-subpages",
    makeIcons: 'dead: settings/advanced.tsx shows its button only when showMakeIcons, which is `__DEV__ && false`',
    reallyRemoveAccount: walletRemove,
    walletsRoot: 'not a route of its own: the screen of settingsTabs.walletsTab (settings/routes.tsx), which settings-subpages opens',
    chatMessagePopup: 'dead: the app never navigates to it (message menus open in place)',
    chatUnfurlMapPopup:
      "opened only from a map unfurl, and none is made: Keybase's maps proxy (maps-proxy.core.keybaseapi.com) returns 403 because its Google Maps billing is disabled",
    kextPermission: `${desktopOnly} (the macOS kernel extension permission popup; Settings > Files shows its entry only on macOS and Windows)`,
    paperkey: phoneNew,
    recoverPasswordPgpWarning:
      'unreachable: it closes itself unless a password recovery started with a real paper key is waiting on it, and no real paper key is ever submitted',
    recoverPasswordPromptResetPassword: 'unreachable: the service asks it only of an account with no active key; every test account has devices',
    resetConfirm: resetStart,
    resetEnterPassword: resetStart,
    resetKnowPassword: resetStart,
    resetWaiting: resetStart,
    selectOtherDevice: phoneNew,
    setPublicName: phoneNew,
    signupError: 'manual-only: signup-submit (shown only when the final submit fails)',
    teamAddToTeamContacts:
      "manual-only: contacts-import (the add-members wizard's \"From your contacts\", teams/add-members-wizard/add-from-where.tsx and confirm.tsx, opens it, and on open it asks for contacts access and reads the whole address book, teams/common/use-contacts.native.tsx)",
    teamInviteByContact:
      'dead: nothing in the app navigates to it (teams/routes.tsx only registers it); the add-members wizard\'s "From your contacts" opens teamAddToTeamContacts instead',
  },
  rpcs: {
    'chat.1.local.addTeamMemberAfterReset': 'needs a member who reset their account; account resets are owner: excluded',
    'chat.1.local.cancelUploadTempFile':
      "desktop only: it cancels a pasted image's temp upload, and only a desktop paste makes one (chat/conversation/attachment-actions.tsx makePasteAttachment, from the desktop thread's onPaste in chat/conversation/normal/index.tsx); the phone's image paste hands the titles screen paths without an outbox id, so neither of its senders in chat/conversation/attachment-get-titles.tsx (the desktop-only Cancel button, and the images a compression drops) has one to cancel",
    'chat.1.local.dismissJourneycard':
      "server feature flag 'journeycard' is off for the test accounts (journey_card_manager.go checkFeature); no card is shown, so nothing can be dismissed",
    'chat.1.local.RetryPost':
      'no failed send that offers Retry can be made on demand: a text over the length limit offers Edit or Cancel, a min writer or restricted bot refusal offers neither (chat/conversation/messages/wrapper/wrapper.tsx getEcrType), and the failures left (offline for 10 minutes, 180 attempts, a failed identify) need the service cut off or a broken account',
    'chat.1.local.setWelcomeMessage': 'dead: no call site in the app',
    'chat.1.local.trackGiphySelect':
      "desktop only: the phone picks a GIF inside a WebView of the Go service's gallery page (chat/conversation/giphy/index.tsx NativeGiphySearch), which posts and tracks the pick itself; only the desktop grid sends this RPC",
    'keybase.1.account.cancelReset': resetStart,
    'keybase.1.config.logSend': 'manual-only: feedback-send',
    'keybase.1.ctl.dbNuke': 'never pressed (ruling): Settings > Advanced > DB Nuke wipes the phone\'s local data',
    'keybase.1.ctl.setOnLoginStartup': `${desktopOnly}: open at login (constants/init/index.tsx sends it only on Linux and Windows)`,
    'keybase.1.emails.setVisibilityEmail': 'manual-only: email-link (Make searchable is never pressed, by ruling)',
    'keybase.1.home.homeDismissAnnouncement':
      "dismissing a People feed announcement (its Later) is kept by the server for the account with no way back, so a run could do it once; the announcements shown are the server's, not the gate's",
    'keybase.1.home.homeSkipTodoType': 'skipping a People feed todo is kept by the server for the account with no way back, so a run could do it once',
    'keybase.1.login.accountDelete': 'manual-only: delete-account-confirm',
    'keybase.1.pgp.pgpKeyGenDefault': 'the phone cannot make a PGP key (PgpMobileUnsupported); profile-proofs drops a key the second account\'s peer made instead',
    'keybase.1.pgp.pgpStorageDismiss': `${desktopOnly}: sent on NotifyPGP.pgpKeyInSecretStoreFile only in the desktop branch of constants/init/index.tsx`,
    'keybase.1.phoneNumbers.addPhoneNumber': 'manual-only: sms-code (Add phone\'s Continue sends a real SMS, never pressed)',
    'keybase.1.phoneNumbers.deletePhoneNumber': 'manual-only: sms-code (needs a verified phone number)',
    'keybase.1.phoneNumbers.resendVerificationForPhoneNumber': 'manual-only: sms-code',
    'keybase.1.phoneNumbers.setVisibilityPhoneNumber': 'manual-only: sms-code (needs a verified phone number)',
    'keybase.1.phoneNumbers.verifyPhoneNumber': 'manual-only: sms-code',
    'keybase.1.reachability.startReachability': 'dead: no call site in the app',
    'keybase.1.saltpack.saltpackDecryptFile': cryptoTextOnly,
    'keybase.1.saltpack.saltpackEncryptFile': cryptoTextOnly,
    'keybase.1.saltpack.saltpackSaveCiphertextToFile': cryptoTextOnly,
    'keybase.1.saltpack.saltpackSaveSignedMsgToFile': cryptoTextOnly,
    'keybase.1.saltpack.saltpackSignFile': cryptoTextOnly,
    'stellar.1.local.deleteWalletAccountLocal': walletRemove,
    'keybase.1.account.enterResetPipeline': resetStart,
    'keybase.1.config.startUpdateIfNeeded': `${desktopOnly}: the desktop app updater (desktop/renderer/remote-event-handler.desktop.tsx)`,
    'keybase.1.ctl.stop': `${desktopOnly}: the desktop tab bar quit menu and the desktop quit event`,
    'keybase.1.identify3.identify3IgnoreUser': `${desktopOnly}: the desktop tracker popup (tracker/remote-proxy.desktop.tsx)`,
    'keybase.1.install.installFuse': `${desktopOnly}: the FUSE driver install (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.install.installKBFS': `${desktopOnly}: the KBFS install (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.install.uninstallKBFS': `${desktopOnly}: the KBFS uninstall (util/fs-platform.tsx returns before it on mobile)`,
    'keybase.1.login.paperKeySubmit':
      'sent only from chatEnterPaperkey (chat/conversation/rekey/enter-paper-key.tsx), which needs a folder waiting on a rekey and a real paper key; no real paper key is ever submitted',
    'keybase.1.rekey.rekeyStatusFinish': `${desktopOnly}: the desktop unlock-folders window (desktop/renderer/remote-event-handler.desktop.tsx)`,
    'keybase.1.signup.signup': 'manual-only: signup-submit',
    'keybase.1.user.blockUser': 'dead: no call site in the app (blocking goes through setUserBlocks)',
    'keybase.1.user.reportUser': 'manual-only: block-report-submit',
    'keybase.1.user.unblockUser': 'dead: no call site in the app (unblocking goes through setUserBlocks)',
    'keybase.1.teams.teamAddEmailsBulk':
      'no screen that sends it opens: its senders are the teamInviteByEmail and teamInviteByContact screens (teams/invite-by-email.tsx, teams/invite-by-contact/team-invite-by-contacts.tsx), and nothing in the app navigates to either; the email invite goes through the add-members wizard (teamAddMembersMultiRole)',
    'keybase.1.teams.teamCreate':
      "root team only: its one sender (teams/team-page-actions.tsx createNewTeamAndNavigate) runs from chat's convert-to-team dialog, which makes a root team outside KB_E2E_TEAM, and from teamNewTeamDialog, which nothing navigates to (a subteam is made by the wizard, teamCreateFancy)",
    'keybase.1.teams.teamCreateSeitanTokenV2':
      'no screen that sends it opens: its one sender is the teamInviteByContact screen (teams/invite-by-contact/team-invite-by-contacts.tsx), and nothing in the app navigates to it',
    'keybase.1.teams.teamReAddMemberAfterReset':
      'needs a member who reset their account (the files reset banner, fs/banner/reset-banner.tsx); account resets are owner: excluded',
    'chat.1.local.archiveChatDelete': backupRunningOnly,
    'chat.1.local.archiveChatPause': backupRunningOnly,
    'chat.1.local.archiveChatResume': backupRunningOnly,
    'keybase.1.SimpleFS.simpleFSArchiveCancelOrDismissJob': backupRunningOnly,
    'keybase.1.SimpleFS.simpleFSArchiveAllFiles': backupAll,
    'keybase.1.SimpleFS.simpleFSArchiveAllGitRepos': backupAll,
    'keybase.1.SimpleFS.simpleFSDismissUpload':
      "manual-only: files-upload-failed-dismiss (the phone sends it only from a failed upload row's Dismiss, fs/browser/rows/still.tsx; a successful upload's card hides itself and sends nothing)",
    'keybase.1.SimpleFS.simpleFSCancelDownload':
      "iOS sends it only when another file action is picked while a Save runs (fs/common/path-item-action/menu-container.tsx cancelAfter); the phone has no download card (Save is not a regular download), and the user's cancel, the menu's Close, sends simpleFSDismissDownload, which the service cancels the download in (go/kbfs/simplefs/downloads.go dismissDownload; files-save-photos cancels a save that way). The download card's cancel is covered by fs/footer/download.test.tsx",
    'keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed': `${desktopOnly}: the system file manager banner (util/fs-platform.tsx returns on mobile)`,
  },
  surfaces: {
    camera: 'manual-only: camera-capture',
  },
}
