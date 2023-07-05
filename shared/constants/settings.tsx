import * as ChatConstants from './chat2'
import {useConfigState} from './config'
import * as Z from '../util/zustand'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import HiddenString from '../util/hidden-string'
import type * as Types from './types/settings'
import type {TypedState} from './reducer'
import {getMeta} from './chat2/meta'
import type {
  e164ToDisplay as e164ToDisplayType,
  phoneUtil as phoneUtilType,
  ValidationResult as ValidationResultType,
  PhoneNumberFormat as PhoneNumberFormatType,
} from '../util/phone-numbers'

export const makeEmailRow = (): Types.EmailRow => ({
  email: '',
  isPrimary: false,
  isVerified: false,
  lastVerifyEmailDate: 0,
  visibility: 0,
})

export const makePhoneRow = (): Types.PhoneRow => ({
  displayNumber: '',
  e164: '',
  searchable: false,
  superseded: false,
  verified: false,
})

export const toPhoneRow = (p: RPCTypes.UserPhoneNumber) => {
  const {e164ToDisplay} = require('../util/phone-numbers') as {e164ToDisplay: typeof e164ToDisplayType}
  return {
    ...makePhoneRow(),
    displayNumber: e164ToDisplay(p.phoneNumber),
    e164: p.phoneNumber,
    searchable: p.visibility === RPCTypes.IdentityVisibility.public,
    superseded: p.superseded,
    verified: p.verified,
  }
}

export const makeState = (): Types.State => ({
  chat: {
    contactSettings: {
      error: '',
      settings: undefined,
    },
    unfurl: {unfurlWhitelist: []},
  },
  contacts: {
    alreadyOnKeybase: [],
    importError: '',
    importPromptDismissed: false,
    permissionStatus: 'unknown',
    waitingToShowJoinedModal: false,
  },
  email: {
    error: '',
    newEmail: '',
  },
  feedback: {},
  invites: {
    acceptedInvites: [],
    pendingInvites: [],
  },
  notifications: {
    allowEdit: false,
    groups: new Map(),
  },
  password: {
    newPassword: new HiddenString(''),
    newPasswordConfirm: new HiddenString(''),
    rememberPassword: true,
  },
  phoneNumbers: {
    addedPhone: false,
    error: '',
    pendingVerification: '',
  },
})

export const getExtraChatLogsForLogSend = (state: TypedState) => {
  const chat = state.chat2
  const c = ChatConstants.getSelectedConversation()
  if (c) {
    const metaMap = getMeta(state, c)
    return {
      badgeMap: chat.badgeMap.get(c),
      editingMap: chat.editingMap.get(c),
      messageMap: [...(chat.messageMap.get(c)?.values() ?? [])].map(m => ({
        a: m.author,
        i: m.id,
        o: m.ordinal,
        out: (m.type === 'text' || m.type === 'attachment') && m.outboxID,
        s: (m.type === 'text' || m.type === 'attachment') && m.submitState,
        t: m.type,
      })),
      messageOrdinals: chat.messageOrdinals.get(c),
      metaMap: {
        channelname: 'x',
        conversationIDKey: metaMap.conversationIDKey,
        description: 'x',
        inboxVersion: metaMap.inboxVersion,
        isMuted: metaMap.isMuted,
        membershipType: metaMap.membershipType,
        notificationsDesktop: metaMap.notificationsDesktop,
        notificationsGlobalIgnoreMentions: metaMap.notificationsGlobalIgnoreMentions,
        notificationsMobile: metaMap.notificationsMobile,
        offline: metaMap.offline,
        participants: 'x',
        rekeyers: metaMap.rekeyers?.size,
        resetParticipants: metaMap.resetParticipants?.size,
        retentionPolicy: metaMap.retentionPolicy,
        snippet: 'x',
        snippetDecoration: RPCChatTypes.SnippetDecoration.none,
        supersededBy: metaMap.supersededBy,
        supersedes: metaMap.supersedes,
        teamRetentionPolicy: metaMap.teamRetentionPolicy,
        teamType: metaMap.teamType,
        teamname: metaMap.teamname,
        timestamp: metaMap.timestamp,
        tlfname: metaMap.tlfname,
        trustedState: metaMap.trustedState,
        wasFinalizedBy: metaMap.wasFinalizedBy,
      },
      pendingOutboxToOrdinal: chat.pendingOutboxToOrdinal.get(c),
      unreadMap: chat.unreadMap.get(c),
    }
  }
  return {}
}

// Get phone number in e.164, or null if we can't parse it.
export const getE164 = (phoneNumber: string, countryCode?: string) => {
  const {phoneUtil, ValidationResult, PhoneNumberFormat} = require('../util/phone-numbers') as {
    phoneUtil: typeof phoneUtilType
    ValidationResult: typeof ValidationResultType
    PhoneNumberFormat: typeof PhoneNumberFormatType
  }
  try {
    const parsed = countryCode ? phoneUtil.parse(phoneNumber, countryCode) : phoneUtil.parse(phoneNumber)
    const reason = phoneUtil.isPossibleNumberWithReason(parsed)
    if (reason !== ValidationResult.IS_POSSIBLE) {
      return null
    }
    return phoneUtil.format(parsed, PhoneNumberFormat.E164)
  } catch (e) {
    return null
  }
}

export const securityGroup = 'security'
export const soundGroup = 'sound'
export const traceInProgressKey = 'settings:traceInProgress'
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'
export const importContactsConfigKey = (username: string) => `ui.importContacts.${username}`
export const refreshNotificationsWaitingKey = 'settingsTabs.refreshNotifications'
export const chatUnfurlWaitingKey = 'settings:chatUnfurlWaitingKey'
export const contactSettingsLoadWaitingKey = 'settings:contactSettingsLoadWaitingKey'
export const contactSettingsSaveWaitingKey = 'settings:contactSettingsSaveWaitingKey'
export const setLockdownModeWaitingKey = 'settings:setLockdownMode'
export const loadLockdownModeWaitingKey = 'settings:loadLockdownMode'
export const checkPasswordWaitingKey = 'settings:checkPassword'
export const dontUseWaitingKey = 'settings:settingsPage'
export const sendFeedbackWaitingKey = 'settings:sendFeedback'
export const addPhoneNumberWaitingKey = 'settings:addPhoneNumber'
export const resendVerificationForPhoneWaitingKey = 'settings:resendVerificationForPhone'
export const verifyPhoneNumberWaitingKey = 'settings:verifyPhoneNumber'
export const importContactsWaitingKey = 'settings:importContacts'
export const addEmailWaitingKey = 'settings:addEmail'
export const loadSettingsWaitingKey = 'settings:loadSettings'
export const settingsWaitingKey = 'settings:generic'

export const aboutTab = 'settingsTabs.aboutTab'
export const advancedTab = 'settingsTabs.advancedTab'
export const chatTab = 'settingsTabs.chatTab'
export const cryptoTab = 'settingsTabs:cryptoTab'
export const devicesTab = 'settingsTabs.devicesTab'
export const displayTab = 'settingsTabs.displayTab'
export const feedbackTab = 'settingsTabs.feedbackTab'
export const foldersTab = 'settingsTabs.foldersTab'
export const fsTab = 'settingsTabs.fsTab'
export const gitTab = 'settingsTabs.gitTab'
export const invitationsTab = 'settingsTabs.invitationsTab'
export const accountTab = 'settingsTabs.accountTab'
export const notificationsTab = 'settingsTabs.notificationsTab'
export const passwordTab = 'settingsTabs.password'
export const screenprotectorTab = 'settingsTabs.screenprotector'
export const logOutTab = 'settingsTabs.logOutTab'
export const updatePaymentTab = 'settingsTabs.updatePaymentTab'
export const walletsTab = 'settingsTabs.walletsTab'
export const contactsTab = 'settingsTabs.contactsTab'
export const whatsNewTab = 'settingsTabs.whatsNewTab'

export type SettingsTab =
  | typeof accountTab
  | typeof updatePaymentTab
  | typeof invitationsTab
  | typeof notificationsTab
  | typeof advancedTab
  | typeof feedbackTab
  | typeof aboutTab
  | typeof devicesTab
  | typeof displayTab
  | typeof gitTab
  | typeof foldersTab
  | typeof fsTab
  | typeof logOutTab
  | typeof screenprotectorTab
  | typeof passwordTab
  | typeof walletsTab
  | typeof chatTab
  | typeof cryptoTab
  | typeof contactsTab
  | typeof whatsNewTab

type Store = {
  checkPasswordIsCorrect?: boolean
  didToggleCertificatePinning?: boolean
  lockdownModeEnabled?: boolean
}

const initialStore: Store = {
  checkPasswordIsCorrect: undefined,
  didToggleCertificatePinning: undefined,
  lockdownModeEnabled: undefined,
}

export type State = Store & {
  dispatch: {
    checkPassword: (password: string) => void
    loadLockdownMode: () => void
    resetCheckPassword: () => void
    resetState: 'default'
    setDidToggleCertificatePinning: (t?: boolean) => void
    setLockdownMode: (l: boolean) => void
  }
}

export const useState = Z.createZustand<State>(set => {
  // const reduxDispatch = Z.getReduxDispatch()
  const dispatch: State['dispatch'] = {
    checkPassword: passphrase => {
      set(s => {
        s.checkPasswordIsCorrect = undefined
      })
      const f = async () => {
        const res = await RPCTypes.accountPassphraseCheckRpcPromise({passphrase}, checkPasswordWaitingKey)
        set(s => {
          s.checkPasswordIsCorrect = res
        })
      }
      Z.ignorePromise(f())
    },
    loadLockdownMode: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const result = await RPCTypes.accountGetLockdownModeRpcPromise(
            undefined,
            loadLockdownModeWaitingKey
          )
          set(s => {
            s.lockdownModeEnabled = result.status
          })
        } catch (_) {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      Z.ignorePromise(f())
    },
    resetCheckPassword: () => {
      set(s => {
        s.checkPasswordIsCorrect = undefined
      })
    },
    resetState: 'default',
    setDidToggleCertificatePinning: t => {
      set(s => {
        s.didToggleCertificatePinning = t
      })
    },
    setLockdownMode: enabled => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          await RPCTypes.accountSetLockdownModeRpcPromise({enabled}, setLockdownModeWaitingKey)
          set(s => {
            s.lockdownModeEnabled = enabled
          })
        } catch (_) {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
