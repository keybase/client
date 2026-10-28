// Routes and write RPCs the desktop release run does not have to reach, each with why. A reason
// starting `manual-only: <id>` names an entry of MANUAL_ONLY (manual-only.ts): the run stops at
// that edge and a person does the rest. Signed-out, provisioning and reset screens are not
// excluded: flows are to cover them.
import type {Exclusions} from './census-lib'

const phoneOnly = 'phone only: desktop has no such screen'

export const EXCLUSIONS: Exclusions = {
  routes: {
    accountSwitcher: `${phoneOnly} (opened only from the phone header avatar)`,
    chatConversation: `${phoneOnly} (desktop shows the conversation inside chatRoot)`,
    chatInfoPanel: `${phoneOnly} (desktop shows the info panel inside chatRoot)`,
    chatLocationPreview: phoneOnly,
    chatMessagePopup: `${phoneOnly}; the app never opens it (message menus are in-place popups)`,
    checkPassphraseBeforeDeleteAccount: phoneOnly,
    decryptOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    encryptOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    incomingShareNew: `${phoneOnly}: items shared from another app`,
    makeIcons: 'developer tool, not a user screen',
    reallyRemoveAccount: 'needs a wallet account; payments are unsupported and the test account has none',
    'settingsTabs.contactsTab': phoneOnly,
    'settingsTabs.cryptoTab': 'tablet-only settings sub-tab (desktop has it as the crypto tab)',
    'settingsTabs.devicesTab': 'tablet-only settings sub-tab (desktop has it as the devices tab)',
    'settingsTabs.gitTab': 'tablet-only settings sub-tab (desktop has it as the git tab)',
    settingsPushPrompt: phoneOnly,
    signOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    teamAddToTeamContacts: `${phoneOnly} (desktop renders nothing)`,
    teamInviteByContact: `${phoneOnly} (desktop renders nothing)`,
    verifyOutput: `${phoneOnly} (desktop shows the output beside the input)`,
    walletsRoot: 'not a route of its own: the screen of settingsTabs.walletsTab',
  },
  rpcs: {
    'chat.1.local.locationUpdate': 'mobile only: location sharing (chatLocationPreview) and the native location watcher',
    'chat.1.local.setWelcomeMessage': 'dead: no call site in the app',
    'keybase.1.apiserver.Delete': 'mobile only: push token delete on logout (stores/push.tsx; desktop is a no-op)',
    'keybase.1.apiserver.Post':
      'mobile push token upload (stores/push.tsx), and hiding a stellar address on a profile (tracker/assertion.tsx); payments are unsupported',
    'keybase.1.appState.updateMobileNetState': 'mobile only: the native platform listener (constants/init)',
    'keybase.1.config.logSend': 'manual-only: feedback-send',
    'keybase.1.config.startUpdateIfNeeded': 'manual-only: auto-update-installer',
    'keybase.1.contacts.saveContactList': 'mobile only: phone contacts import (stores/settings-contacts.tsx)',
    'keybase.1.incomingShare.setPreference': 'mobile only: the iOS share attachment setting (settings/chat.tsx)',
    'keybase.1.install.installFuse': 'manual-only: os-fuse-mount',
    'keybase.1.install.installKBFS': 'manual-only: os-fuse-mount',
    'keybase.1.install.uninstallKBFS': 'manual-only: os-fuse-mount',
    'keybase.1.login.accountDelete': 'manual-only: delete-account-confirm',
    'keybase.1.phoneNumbers.addPhoneNumber': 'manual-only: sms-code (adding a number sends the SMS)',
    'keybase.1.phoneNumbers.resendVerificationForPhoneNumber': 'manual-only: sms-code',
    'keybase.1.phoneNumbers.verifyPhoneNumber': 'manual-only: sms-code',
    'keybase.1.reachability.startReachability': 'dead: no call site in the app',
    'keybase.1.signup.signup': 'manual-only: signup-submit',
    'keybase.1.SimpleFS.simpleFSSetSyncOnCellular': 'mobile only: the files settings cellular toggle (settings/files)',
    'keybase.1.user.blockUser': 'dead: no call site in the app (blocking goes through setUserBlocks)',
    'keybase.1.user.reportUser': 'manual-only: block-report-submit',
    'keybase.1.user.unblockUser': 'dead: no call site in the app (unblocking goes through setUserBlocks)',
    'stellar.1.local.deleteWalletAccountLocal': 'needs a wallet account; payments are unsupported and the test account has none',
  },
}
