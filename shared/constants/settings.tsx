import * as C from '.'
import * as T from './types'
import * as EngineGen from '../actions/engine-gen-gen'
import openURL from '@/util/open-url'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import * as Tabs from './tabs'
import logger from '@/logger'
import {pprofDir} from '@/constants/platform'

export const traceInProgressKey = 'settings:traceInProgress'
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'
export const setLockdownModeWaitingKey = 'settings:setLockdownMode'
export const loadLockdownModeWaitingKey = 'settings:loadLockdownMode'
export const checkPasswordWaitingKey = 'settings:checkPassword'
export const dontUseWaitingKey = 'settings:settingsPage'
export const sendFeedbackWaitingKey = 'settings:sendFeedback'
export const loadSettingsWaitingKey = 'settings:loadSettings'
export const settingsWaitingKey = 'settings:generic'

export const settingsAboutTab = 'settingsTabs.aboutTab'
export const settingsAdvancedTab = 'settingsTabs.advancedTab'
export const settingsArchiveTab = 'settingsTabs.archiveTab'
export const settingsChatTab = 'settingsTabs.chatTab'
export const settingsCryptoTab = 'settingsTabs.cryptoTab'
export const settingsDevicesTab = 'settingsTabs.devicesTab'
export const settingsDisplayTab = 'settingsTabs.displayTab'
export const settingsFeedbackTab = 'settingsTabs.feedbackTab'
export const settingsFoldersTab = 'settingsTabs.foldersTab'
export const settingsFsTab = 'settingsTabs.fsTab'
export const settingsGitTab = 'settingsTabs.gitTab'
export const settingsInvitationsTab = 'settingsTabs.invitationsTab'
export const settingsAccountTab = 'settingsTabs.accountTab'
export const settingsNotificationsTab = 'settingsTabs.notificationsTab'
export const settingsPasswordTab = 'settingsTabs.password'
export const settingsScreenprotectorTab = 'settingsTabs.screenprotector'
export const settingsLogOutTab = 'settingsTabs.logOutTab'
export const settingsUpdatePaymentTab = 'settingsTabs.updatePaymentTab'
export const settingsWalletsTab = 'settingsTabs.walletsTab'
export const settingsContactsTab = 'settingsTabs.contactsTab'
export const settingsWhatsNewTab = 'settingsTabs.whatsNewTab'

export type SettingsTab =
  | typeof settingsAccountTab
  | typeof settingsUpdatePaymentTab
  | typeof settingsInvitationsTab
  | typeof settingsNotificationsTab
  | typeof settingsAdvancedTab
  | typeof settingsFeedbackTab
  | typeof settingsAboutTab
  | typeof settingsDevicesTab
  | typeof settingsDisplayTab
  | typeof settingsGitTab
  | typeof settingsFoldersTab
  | typeof settingsFsTab
  | typeof settingsLogOutTab
  | typeof settingsScreenprotectorTab
  | typeof settingsPasswordTab
  | typeof settingsWalletsTab
  | typeof settingsChatTab
  | typeof settingsCryptoTab
  | typeof settingsContactsTab
  | typeof settingsWhatsNewTab

type Store = T.Immutable<{
  checkPasswordIsCorrect?: boolean
  didToggleCertificatePinning?: boolean
  lockdownModeEnabled?: boolean
  proxyData?: T.RPCGen.ProxyData
}>

const initialStore: Store = {
  checkPasswordIsCorrect: undefined,
  didToggleCertificatePinning: undefined,
  lockdownModeEnabled: undefined,
  proxyData: undefined,
}

export interface State extends Store {
  dispatch: {
    checkPassword: (password: string) => void
    dbNuke: () => void
    deleteAccountForever: (passphrase?: string) => void
    loadLockdownMode: () => void
    loadProxyData: () => void
    loadSettings: () => void
    loginBrowserViaWebAuthToken: () => void
    onEngineIncoming: (action: EngineGen.Actions) => void
    processorProfile: (durationSeconds: number) => void
    resetCheckPassword: () => void
    resetState: 'default'
    setDidToggleCertificatePinning: (t?: boolean) => void
    setLockdownMode: (l: boolean) => void
    setProxyData: (proxyData: T.RPCGen.ProxyData) => void
    stop: (exitCode: T.RPCGen.ExitCode) => void
    trace: (durationSeconds: number) => void
  }
}

let maybeLoadAppLinkOnce = false
export const _useState = Z.createZustand<State>(set => {
  const maybeLoadAppLink = () => {
    const phones = C.useSettingsPhoneState.getState().phones
    if (!phones || phones.size > 0) {
      return
    }

    if (maybeLoadAppLinkOnce || !C.useConfigState.getState().startup.link.endsWith('/phone-app')) {
      return
    }
    maybeLoadAppLinkOnce = true
    C.useRouterState.getState().dispatch.switchTab(Tabs.settingsTab)
    C.useRouterState.getState().dispatch.navigateAppend('settingsAddPhone')
  }

  const dispatch: State['dispatch'] = {
    checkPassword: passphrase => {
      set(s => {
        s.checkPasswordIsCorrect = undefined
      })
      const f = async () => {
        const res = await T.RPCGen.accountPassphraseCheckRpcPromise({passphrase}, checkPasswordWaitingKey)
        set(s => {
          s.checkPasswordIsCorrect = res
        })
      }
      C.ignorePromise(f())
    },
    dbNuke: () => {
      const f = async () => {
        await T.RPCGen.ctlDbNukeRpcPromise(undefined, settingsWaitingKey)
      }
      C.ignorePromise(f())
    },
    deleteAccountForever: passphrase => {
      const f = async () => {
        const username = C.useCurrentUserState.getState().username

        if (!username) {
          throw new Error('Unable to delete account: no username set')
        }

        await T.RPCGen.loginAccountDeleteRpcPromise({passphrase}, settingsWaitingKey)
        C.useConfigState.getState().dispatch.setJustDeletedSelf(username)
        C.useRouterState.getState().dispatch.clearModals()
        C.useRouterState.getState().dispatch.navigateAppend(Tabs.loginTab)
      }
      C.ignorePromise(f())
    },
    loadLockdownMode: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          const result = await T.RPCGen.accountGetLockdownModeRpcPromise(
            undefined,
            loadLockdownModeWaitingKey
          )
          set(s => {
            s.lockdownModeEnabled = result.status
          })
        } catch {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      C.ignorePromise(f())
    },
    loadProxyData: () => {
      const f = async () => {
        try {
          const result = await T.RPCGen.configGetProxyDataRpcPromise()
          set(s => {
            s.proxyData = result
          })
        } catch (err) {
          logger.warn('Error in loading proxy data', err)
          return
        }
      }
      C.ignorePromise(f())
    },
    loadSettings: () => {
      const f = async () => {
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          const settings = await T.RPCGen.userLoadMySettingsRpcPromise(undefined, loadSettingsWaitingKey)
          C.useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(settings.emails ?? [])
          C.useSettingsPhoneState.getState().dispatch.setNumbers(settings.phoneNumbers ?? undefined)
          maybeLoadAppLink()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`Error loading settings: ${error.message}`)
          return
        }
      }
      C.ignorePromise(f())
    },
    loginBrowserViaWebAuthToken: () => {
      const f = async () => {
        const link = await T.RPCGen.configGenerateWebAuthTokenRpcPromise()
        openURL(link)
      }
      C.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
          logger.info('email verified')
          C.useSettingsEmailState.getState().dispatch.notifyEmailVerified(action.payload.params.emailAddress)
          break
        case EngineGen.keybase1NotifyUsersPasswordChanged: {
          const randomPW = action.payload.params.state === T.RPCGen.PassphraseState.random
          C.useSettingsPasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
          break
        }
        case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged: {
          const {list} = action.payload.params
          C.useSettingsPhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
          break
        }
        case EngineGen.keybase1NotifyEmailAddressEmailsChanged: {
          const list = action.payload.params.list ?? []
          C.useSettingsEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
          break
        }
        default:
      }
    },
    processorProfile: profileDurationSeconds => {
      const f = async () => {
        await T.RPCGen.pprofLogProcessorProfileRpcPromise({
          logDirForMobile: pprofDir,
          profileDurationSeconds,
        })
        const {decrement, increment} = C.useWaitingState.getState().dispatch
        increment(processorProfileInProgressKey)
        await C.timeoutPromise(profileDurationSeconds * 1_000)
        decrement(processorProfileInProgressKey)
      }
      C.ignorePromise(f())
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
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          await T.RPCGen.accountSetLockdownModeRpcPromise({enabled}, setLockdownModeWaitingKey)
          set(s => {
            s.lockdownModeEnabled = enabled
          })
        } catch {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      C.ignorePromise(f())
    },
    setProxyData: proxyData => {
      const f = async () => {
        try {
          await T.RPCGen.configSetProxyDataRpcPromise({proxyData})
        } catch (err) {
          logger.warn('Error in saving proxy data', err)
        }
      }
      C.ignorePromise(f())
    },
    stop: exitCode => {
      const f = async () => {
        await T.RPCGen.ctlStopRpcPromise({exitCode})
      }
      C.ignorePromise(f())
    },
    trace: durationSeconds => {
      const f = async () => {
        await T.RPCGen.pprofLogTraceRpcPromise({
          logDirForMobile: pprofDir,
          traceDurationSeconds: durationSeconds,
        })
        const {decrement, increment} = C.useWaitingState.getState().dispatch
        increment(traceInProgressKey)
        await C.timeoutPromise(durationSeconds * 1_000)
        decrement(traceInProgressKey)
      }
      C.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
