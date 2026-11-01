// Routes, write RPCs and surfaces the iOS release run does not have to reach, each with why. A reason
// starting `manual-only: <id>` names an entry of IOS_MANUAL_ONLY (manual-only.ts): the run stops at
// that edge and a person does the rest.
import type {Exclusions} from '../../../shared/gate/census-lib.ts'

const desktopOnly = 'desktop only: the phone has no such screen'
// provisioning the signed-in phone as a new device needs a fresh install
const phoneNew = 'manual-only: phone-new-device (the screens that provision this phone as a new device)'
// the signed-out flows stop at "Start account reset" (flows/account-signed-out.test.ts)
const resetStart = 'owner: excluded (account reset start and cancel)'

// the Backup page's whole-account backups (controller ruling, PR 7 live)
const backupAll =
  "manual-only: backup-all (a whole-account backup copies every folder and repo of the account onto the phone, non-test teams' too, and the phone's backup status lists only some of the jobs it starts, so they cannot all be proven cancelled and removed)"

export const IOS_EXCLUSIONS: Exclusions = {
  routes: {
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
    teamInviteByContact:
      'dead: nothing in the app navigates to it (teams/routes.tsx only registers it); the add-members wizard\'s "From your contacts" opens teamAddToTeamContacts instead',
  },
  rpcs: {
    'chat.1.local.addTeamMemberAfterReset': 'needs a member who reset their account; account resets are owner: excluded',
    'chat.1.local.dismissJourneycard':
      "server feature flag 'journeycard' is off for the test accounts (journey_card_manager.go checkFeature); no card is shown, so nothing can be dismissed",
    'chat.1.local.RetryPost':
      'no failed send that offers Retry can be made on demand: a text over the length limit offers Edit or Cancel, a min writer or restricted bot refusal offers neither (chat/conversation/messages/wrapper/wrapper.tsx getEcrType), and the failures left (offline for 10 minutes, 180 attempts, a failed identify) need the service cut off or a broken account',
    'chat.1.local.setWelcomeMessage': 'dead: no call site in the app',
    'chat.1.local.trackGiphySelect':
      "desktop only: the phone picks a GIF inside a WebView of the Go service's gallery page (chat/conversation/giphy/index.tsx NativeGiphySearch), which posts and tracks the pick itself; only the desktop grid sends this RPC",
    'keybase.1.account.cancelReset': resetStart,
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
    'keybase.1.SimpleFS.simpleFSArchiveAllFiles': backupAll,
    'keybase.1.SimpleFS.simpleFSArchiveAllGitRepos': backupAll,
    'keybase.1.SimpleFS.simpleFSSetSfmiBannerDismissed': `${desktopOnly}: the system file manager banner (util/fs-platform.tsx returns on mobile)`,
  },
  surfaces: {
    camera: 'manual-only: camera-capture',
  },
}
