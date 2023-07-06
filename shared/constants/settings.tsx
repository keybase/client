import * as ChatConstants from './chat2'
import * as RPCChatTypes from './types/rpc-chat-gen'
import * as RPCTypes from './types/rpc-gen'
import * as Z from '../util/zustand'
import {RPCError} from '../util/errors'
import * as RouteTreeGen from '../actions/route-tree-gen'
import type * as Types from './types/settings'
import type {TypedState} from './reducer'
import {getMeta} from './chat2/meta'
import {useConfigState} from './config'
import * as Tabs from './tabs'
import logger from '../logger'
import {useState as usePhoneState} from './settings-phone'
import {useState as useEmailState} from './settings-email'

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
  feedback: {},
  notifications: {
    allowEdit: false,
    groups: new Map(),
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
export const importContactsWaitingKey = 'settings:importContacts'
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
          console.log('aaaaaaaaaaaaaa TODO EMAIL!!!')
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
export {usePhoneState, useEmailState}
export {useState as usePasswordState} from './settings-password'
export {useState as useInvitesState} from './settings-invites'
export {
  verifyPhoneNumberWaitingKey,
  addPhoneNumberWaitingKey,
  resendVerificationForPhoneWaitingKey,
  getE164,
} from './settings-phone'
export {addEmailWaitingKey} from './settings-email'
