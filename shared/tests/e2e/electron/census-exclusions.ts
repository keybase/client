// Routes and write RPCs the desktop release run does not have to reach, each with why. A reason
// starting `manual-only: <id>` names an entry of MANUAL_ONLY (manual-only.ts): the run stops at
// that edge and a person does the rest. Signed-out, provisioning and reset screens are covered by
// flows, except those only first-device provisioning or a started account reset reach.
import type {Exclusions} from '../shared/gate/census-lib'

const phoneOnly = 'phone only: desktop has no such screen'
const firstDevice = 'owner: excluded (first-device provisioning screens; no test account without a device on this machine)'
const resetStart = 'owner: excluded (account reset start and cancel)'
const resetFromProvisioning = 'owner: excluded (account reset start and cancel; reached only from first-device provisioning screens)'

export const EXCLUSIONS: Exclusions = {
  routes: {
    accountSwitcher: `${phoneOnly} (opened only from the phone header avatar)`,
    chatConversation: `${phoneOnly} (desktop shows the conversation inside chatRoot)`,
    chatInfoPanel: `${phoneOnly} (desktop shows the info panel inside chatRoot)`,
    chatLocationPreview: phoneOnly,
    chatMessagePopup: `${phoneOnly}; the app never opens it (message menus are in-place popups)`,
    chatUnfurlMapPopup:
      "opened only from a map unfurl, and none is made: Keybase's maps proxy (maps-proxy.core.keybaseapi.com) returns 403 because its Google Maps billing is disabled",
    checkPassphraseBeforeDeleteAccount: phoneOnly,
    decryptOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    encryptOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    // an unknown or invalid username stays on the username screen with its banner
    error: `${firstDevice}: shown for a provisioning failure other than an unknown or invalid username`,
    incomingShareNew: `${phoneOnly}: items shared from another app`,
    makeIcons: 'developer tool, not a user screen',
    paperkey: firstDevice,
    password: firstDevice,
    reallyRemoveAccount: 'needs a wallet account; payments are unsupported and the test account has none',
    recoverPasswordPgpWarning:
      'unreachable: it closes itself unless a password recovery started with a real paper key is waiting on it, and no real paper key is ever submitted on the main service',
    recoverPasswordPromptResetPassword: 'unreachable: the service asks it only of an account with no active key; every test account has devices',
    resetConfirm: resetFromProvisioning,
    resetEnterPassword: resetFromProvisioning,
    resetKnowPassword: resetFromProvisioning,
    resetWaiting: resetStart,
    selectOtherDevice: firstDevice,
    setPublicName: firstDevice,
    'settingsTabs.contactsTab': phoneOnly,
    'settingsTabs.cryptoTab': 'tablet-only settings sub-tab (desktop has it as the crypto tab)',
    'settingsTabs.devicesTab': 'tablet-only settings sub-tab (desktop has it as the devices tab)',
    'settingsTabs.gitTab': 'tablet-only settings sub-tab (desktop has it as the git tab)',
    settingsPushPrompt: phoneOnly,
    signupError: 'manual-only: signup-submit (shown only when the final submit fails)',
    signOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    teamAddToTeamContacts: `${phoneOnly} (desktop renders nothing)`,
    teamInviteByContact: `${phoneOnly} (desktop renders nothing)`,
    verifyOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    walletsRoot: 'not a route of its own: the screen of settingsTabs.walletsTab',
    webLinks: `${phoneOnly} (desktop's Settings > About opens Terms and Privacy Policy in the browser)`,
  },
  rpcs: {
    'keybase.1.account.cancelReset': resetStart,
    'keybase.1.account.enterResetPipeline': resetFromProvisioning,
    'chat.1.local.addTeamMemberAfterReset': 'needs a member who reset their account; account resets are owner: excluded',
    'chat.1.local.dismissJourneycard':
      "server feature flag 'journeycard' is off for the test accounts (journey_card_manager.go checkFeature); no card is shown, so nothing can be dismissed",
    'chat.1.local.RetryPost':
      "no failed send that offers Retry can be made on demand: a text over the length limit offers Edit or Cancel, a min writer or restricted bot refusal offers neither (chat/conversation/messages/wrapper/wrapper.tsx getEcrType), the failures left (offline for 10 minutes, 180 attempts, a failed identify) need the service cut off or a broken account, and no server refusal that the desktop UI can bring about on demand was found (any unclassified send error fails as MISC, which offers Retry: go/chat/deliverer.go doNotRetryFailure)",
    'chat.1.local.locationUpdate': 'mobile only: location sharing (chatLocationPreview) and the native location watcher',
    'chat.1.local.setWelcomeMessage': 'dead: no call site in the app',
    'keybase.1.apiserver.Delete': 'mobile only: push token delete on logout (stores/push.tsx; desktop is a no-op)',
    'keybase.1.apiserver.Post':
      'mobile push token upload (stores/push.tsx), and hiding a stellar address on a profile (tracker/assertion.tsx); payments are unsupported',
    'keybase.1.appState.updateMobileNetState': 'mobile only: the native platform listener (constants/init)',
    'keybase.1.config.logSend': 'manual-only: feedback-send',
    'keybase.1.config.startUpdateIfNeeded': 'manual-only: auto-update-installer',
    'keybase.1.contacts.saveContactList': 'mobile only: phone contacts import (stores/settings-contacts.tsx)',
    'keybase.1.ctl.dbNuke': "owner: excluded (wipes the main service's local database)",
    'keybase.1.ctl.setOnLoginStartup': 'owner: excluded (changes the macOS login items)',
    'keybase.1.ctl.stop': 'manual-only: quit-app (stops the main service and the app; the run must keep both)',
    'keybase.1.emails.setVisibilityEmail': 'manual-only: email-link (offered only for a verified email)',
    'keybase.1.home.homeDismissAnnouncement':
      'server-sent content: shown only when the server sends an announcement, which the test accounts do not get',
    'keybase.1.home.homeSkipTodoType': 'one-shot per account: a skipped to-do never returns, so a repeatable flow cannot exist',
    'keybase.1.identify3.identify3IgnoreUser': 'manual-only: external-proofs (needs a broken proof on an external site)',
    'keybase.1.incomingShare.setPreference': 'mobile only: the iOS share attachment setting (settings/chat.tsx)',
    'keybase.1.install.installFuse': 'manual-only: os-fuse-mount',
    'keybase.1.install.installKBFS': 'manual-only: os-fuse-mount',
    'keybase.1.install.uninstallKBFS': 'manual-only: os-fuse-mount',
    'keybase.1.login.accountDelete': 'manual-only: delete-account-confirm',
    'keybase.1.login.deprovision': "revokes the main service's own device, which the run must keep (main stays on the smoke account)",
    'keybase.1.pgp.pgpStorageDismiss':
      "service-initiated: the answer to NotifyPGP.pgpKeyInSecretStoreFile, which the main service (Keychain store) never sends",
    'keybase.1.phoneNumbers.addPhoneNumber': 'manual-only: sms-code (adding a number sends the SMS)',
    'keybase.1.phoneNumbers.deletePhoneNumber': 'manual-only: sms-code (needs a verified phone)',
    'keybase.1.phoneNumbers.resendVerificationForPhoneNumber': 'manual-only: sms-code',
    'keybase.1.phoneNumbers.setVisibilityPhoneNumber': 'manual-only: sms-code (needs a verified phone)',
    'keybase.1.phoneNumbers.verifyPhoneNumber': 'manual-only: sms-code',
    'keybase.1.reachability.startReachability': 'dead: no call site in the app',
    'keybase.1.signup.signup': 'manual-only: signup-submit',
    'keybase.1.SimpleFS.simpleFSSetSyncOnCellular': 'mobile only: the files settings cellular toggle (settings/files)',
    'keybase.1.teams.teamAddEmailsBulk':
      'no desktop sender: the desktop email invite goes through the add-members wizard (teamAddMembersMultiRole); its other senders are the teamInviteByEmail screen, which no desktop screen opens, and the phone contact invite',
    'keybase.1.teams.teamCreate':
      "root team only: chat's convert-to-team dialog makes a root team outside KB_E2E_TEAM, and teamNewTeamDialog has no desktop entry point (a subteam is made by the wizard, teamCreateFancy)",
    'keybase.1.teams.teamCreateSeitanTokenV2': `${phoneOnly}: sent only by the phone contact invite (teamInviteByContact)`,
    'keybase.1.teams.teamReAddMemberAfterReset': 'needs a member who reset their account; account resets are owner: excluded',
    'keybase.1.user.blockUser': 'dead: no call site in the app (blocking goes through setUserBlocks)',
    'keybase.1.user.reportUser': 'manual-only: block-report-submit',
    'keybase.1.user.unblockUser': 'dead: no call site in the app (unblocking goes through setUserBlocks)',
    'stellar.1.local.deleteWalletAccountLocal': 'needs a wallet account; payments are unsupported and the test account has none',
  },
}
