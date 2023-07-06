import * as ChatConstants from './chat2'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import {RPCError} from '../util/errors'
import HiddenString from '../util/hidden-string'
import * as RouteTreeGen from '../actions/route-tree-gen'
import type * as Types from './types/settings'
import type {TypedState} from './reducer'
import {getMeta} from './chat2/meta'
import {useConfigState} from './config'
import * as Tabs from './tabs'
import type {
  e164ToDisplay as e164ToDisplayType,
  phoneUtil as phoneUtilType,
  ValidationResult as ValidationResultType,
  PhoneNumberFormat as PhoneNumberFormatType,
} from '../util/phone-numbers'
import logger from '../logger'

export const makeEmailRow = (): Types.EmailRow => ({
  email: '',
  isPrimary: false,
  isVerified: false,
  lastVerifyEmailDate: 0,
  visibility: 0,
})

export const makePhoneRow = (): PhoneRow => ({
  displayNumber: '',
  e164: '',
  searchable: false,
  superseded: false,
  verified: false,
})

const toPhoneRow = (p: RPCTypes.UserPhoneNumber) => {
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
  proxyData?: RPCTypes.ProxyData
}

const initialStore: Store = {
  checkPasswordIsCorrect: undefined,
  didToggleCertificatePinning: undefined,
  lockdownModeEnabled: undefined,
  proxyData: undefined,
}

export type State = Store & {
  dispatch: {
    checkPassword: (password: string) => void
    loadSettings: () => void
    loadLockdownMode: () => void
    loadProxyData: () => void
    resetCheckPassword: () => void
    resetState: 'default'
    setDidToggleCertificatePinning: (t?: boolean) => void
    setLockdownMode: (l: boolean) => void
    setProxyData: (proxyData: RPCTypes.ProxyData) => void
  }
}

let maybeLoadAppLinkOnce = false
export const useState = Z.createZustand<State>(set => {
  const reduxDispatch = Z.getReduxDispatch()
  const maybeLoadAppLink = () => {
    const phones = usePhoneState.getState().phones
    if (!phones || phones.size > 0) {
      return
    }

    if (
      maybeLoadAppLinkOnce ||
      !useConfigState.getState().startup.link ||
      !useConfigState.getState().startup.link.endsWith('/phone-app')
    ) {
      return
    }
    maybeLoadAppLinkOnce = true
    reduxDispatch(RouteTreeGen.createSwitchTab({tab: Tabs.settingsTab}))
    reduxDispatch(RouteTreeGen.createNavigateAppend({path: ['settingsAddPhone']}))
  }

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
    loadProxyData: () => {
      const f = async () => {
        try {
          const result = await RPCTypes.configGetProxyDataRpcPromise()
          set(s => {
            s.proxyData = result
          })
        } catch (err) {
          logger.warn('Error in loading proxy data', err)
          return
        }
      }
      Z.ignorePromise(f())
    },
    loadSettings: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const settings = await RPCTypes.userLoadMySettingsRpcPromise(undefined, loadSettingsWaitingKey)
          // const emailMap = new Map(
          //   (settings.emails ?? []).map(row => [row.email, {...Constants.makeEmailRow(), ...row}])
          // )
          // TODO email
          usePhoneState.getState().dispatch.setNumbers(settings.phoneNumbers ?? undefined)

          maybeLoadAppLink()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`Error loading settings: ${error.message}`)
          return
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
    setProxyData: proxyData => {
      const f = async () => {
        try {
          await RPCTypes.configSetProxyDataRpcPromise({proxyData})
        } catch (err) {
          logger.warn('Error in saving proxy data', err)
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

type PhoneRow = {
  displayNumber: string
  e164: string
  searchable: boolean
  superseded: boolean
  verified: boolean
}

type PhoneStore = {
  addedPhone: boolean
  defaultCountry?: string
  error: string
  pendingVerification: string
  phones?: Map<string, PhoneRow>
  verificationState?: 'success' | 'error'
}

const initialPhoneStore: PhoneStore = {
  addedPhone: false,
  defaultCountry: undefined,
  error: '',
  pendingVerification: '',
  phones: undefined,
  verificationState: undefined,
}

export type PhoneState = PhoneStore & {
  dispatch: {
    addPhoneNumber: (phoneNumber: string, searchable: boolean) => void
    editPhone: (phone: string, del?: boolean, setSearchable?: boolean) => void
    loadDefaultPhoneCountry: () => void
    notifyPhoneNumberPhoneNumbersChanged: (list?: RPCChatTypes.Keybase1.UserPhoneNumber[]) => void
    resetState: 'default'
    setNumbers: (phoneNumbers?: RPCChatTypes.Keybase1.UserPhoneNumber[]) => void
    verifyPhoneNumber: (phoneNumber: string, code: string) => void
    resendVerificationForPhone: (phoneNumber: string) => void
  }
}

export const makePhoneError = (e: RPCError) => {
  switch (e.code) {
    case RPCTypes.StatusCode.scphonenumberwrongverificationcode:
      return 'Incorrect code, please try again.'
    case RPCTypes.StatusCode.scphonenumberunknown:
      return e.desc
    case RPCTypes.StatusCode.scphonenumberalreadyverified:
      return 'This phone number is already verified.'
    case RPCTypes.StatusCode.scphonenumberverificationcodeexpired:
      return 'Verification code expired, resend and try again.'
    case RPCTypes.StatusCode.scratelimit:
      return 'Sorry, tried too many guesses in a short period of time. Please try again later.'
    default:
      return e.message
  }
}
export const usePhoneState = Z.createZustand<PhoneState>((set, get) => {
  // const reduxDispatch = Z.getReduxDispatch()
  const dispatch: PhoneState['dispatch'] = {
    addPhoneNumber: (phoneNumber, searchable) => {
      const f = async () => {
        logger.info('adding phone number')
        const visibility = searchable
          ? RPCTypes.IdentityVisibility.public
          : RPCTypes.IdentityVisibility.private
        try {
          await RPCTypes.phoneNumbersAddPhoneNumberRpcPromise(
            {phoneNumber, visibility},
            addPhoneNumberWaitingKey
          )
          logger.info('success')
          set(s => {
            s.error = ''
            s.pendingVerification = phoneNumber
            s.verificationState = undefined
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn('error ', error.message)
          const message = makePhoneError(error)
          set(s => {
            s.error = message
            s.pendingVerification = phoneNumber
            s.verificationState = undefined
          })
        }
      }
      Z.ignorePromise(f())
    },
    editPhone: (phoneNumber, del, setSearchable) => {
      const f = async () => {
        if (del) {
          await RPCTypes.phoneNumbersDeletePhoneNumberRpcPromise({phoneNumber})
        }
        if (setSearchable !== undefined) {
          await RPCTypes.phoneNumbersSetVisibilityPhoneNumberRpcPromise({
            phoneNumber,
            visibility: setSearchable
              ? RPCChatTypes.Keybase1.IdentityVisibility.public
              : RPCChatTypes.Keybase1.IdentityVisibility.private,
          })
        }
      }
      Z.ignorePromise(f())
    },
    loadDefaultPhoneCountry: () => {
      const f = async () => {
        // noop if we've already loaded it
        if (get().defaultCountry) {
          return
        }
        const country = await RPCTypes.accountGuessCurrentLocationRpcPromise({
          defaultCountry: 'US',
        })
        set(s => {
          s.defaultCountry = country
        })
      }
      Z.ignorePromise(f())
    },
    notifyPhoneNumberPhoneNumbersChanged: list => {
      set(s => {
        s.phones = new Map((list ?? []).map(row => [row.phoneNumber, toPhoneRow(row)]))
      })
    },
    resendVerificationForPhone: phoneNumber => {
      set(s => {
        s.error = ''
        s.pendingVerification = phoneNumber
        s.verificationState = undefined
      })
      const f = async () => {
        logger.info(`resending verification code for ${phoneNumber}`)
        try {
          await RPCTypes.phoneNumbersResendVerificationForPhoneNumberRpcPromise(
            {phoneNumber},
            resendVerificationForPhoneWaitingKey
          )
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const message = makePhoneError(error)
          logger.warn('error ', message)
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = false
            s.error = message
            s.verificationState = 'error'
          })
        }
      }
      Z.ignorePromise(f())
    },
    resetState: 'default',
    setNumbers: phoneNumbers => {
      set(s => {
        s.phones = phoneNumbers?.reduce<Map<string, PhoneRow>>((map, row) => {
          if (map.get(row.phoneNumber) && !map.get(row.phoneNumber)?.superseded) {
            return map
          }
          map.set(row.phoneNumber, toPhoneRow(row))
          return map
        }, new Map())
      })
    },
    verifyPhoneNumber: (phoneNumber, code) => {
      const f = async () => {
        logger.info('verifying phone number')
        try {
          await RPCTypes.phoneNumbersVerifyPhoneNumberRpcPromise(
            {code, phoneNumber},
            verifyPhoneNumberWaitingKey
          )
          logger.info('success')
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = true
            s.error = ''
            s.verificationState = 'success'
          })
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          const message = makePhoneError(error)
          logger.warn('error ', message)
          set(s => {
            if (phoneNumber !== s.pendingVerification) {
              logger.warn("Got verifiedPhoneNumber but number doesn't match")
              return
            }
            s.addedPhone = false
            s.error = message
            s.verificationState = 'error'
          })
        }
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialPhoneStore,
    dispatch,
  }
})
