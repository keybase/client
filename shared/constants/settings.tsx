import * as C from '.'
import * as T from './types'
import * as EngineGen from '../actions/engine-gen-gen'
import openURL from '../util/open-url'
import * as Z from '../util/zustand'
import {RPCError} from '../util/errors'
import * as Tabs from './tabs'
import logger from '../logger'
import {pprofDir} from '../constants/platform'

export const traceInProgressKey = 'settings:traceInProgress'
export const processorProfileInProgressKey = 'settings:processorProfileInProgress'
export const setLockdownModeWaitingKey = 'settings:setLockdownMode'
export const loadLockdownModeWaitingKey = 'settings:loadLockdownMode'
export const checkPasswordWaitingKey = 'settings:checkPassword'
export const dontUseWaitingKey = 'settings:settingsPage'
export const sendFeedbackWaitingKey = 'settings:sendFeedback'
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
  proxyData?: T.RPCGen.ProxyData
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

    if (
      maybeLoadAppLinkOnce ||
      !C.useConfigState.getState().startup.link ||
      !C.useConfigState.getState().startup.link.endsWith('/phone-app')
    ) {
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
      Z.ignorePromise(f())
    },
    dbNuke: () => {
      const f = async () => {
        await T.RPCGen.ctlDbNukeRpcPromise(undefined, settingsWaitingKey)
      }
      Z.ignorePromise(f())
    },
    deleteAccountForever: passphrase => {
      const f = async () => {
        const username = C.useCurrentUserState.getState().username

        if (!username) {
          throw new Error('Unable to delete account: no username set')
        }

        await T.RPCGen.loginAccountDeleteRpcPromise({passphrase}, settingsWaitingKey)
        C.useConfigState.getState().dispatch.setJustDeletedSelf(username)
        C.useRouterState.getState().dispatch.navigateAppend(Tabs.loginTab)
      }
      Z.ignorePromise(f())
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
          const result = await T.RPCGen.configGetProxyDataRpcPromise()
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
      Z.ignorePromise(f())
    },
    loginBrowserViaWebAuthToken: () => {
      const f = async () => {
        const link = await T.RPCGen.configGenerateWebAuthTokenRpcPromise()
        openURL(link)
      }
      Z.ignorePromise(f())
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
        await Z.timeoutPromise(profileDurationSeconds * 1_000)
        decrement(processorProfileInProgressKey)
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
        if (!C.useConfigState.getState().loggedIn) {
          return
        }
        try {
          await T.RPCGen.accountSetLockdownModeRpcPromise({enabled}, setLockdownModeWaitingKey)
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
          await T.RPCGen.configSetProxyDataRpcPromise({proxyData})
        } catch (err) {
          logger.warn('Error in saving proxy data', err)
        }
      }
      Z.ignorePromise(f())
    },
    stop: exitCode => {
      const f = async () => {
        await T.RPCGen.ctlStopRpcPromise({exitCode})
      }
      Z.ignorePromise(f())
    },
    trace: durationSeconds => {
      const f = async () => {
        await T.RPCGen.pprofLogTraceRpcPromise({
          logDirForMobile: pprofDir,
          traceDurationSeconds: durationSeconds,
        })
        const {decrement, increment} = C.useWaitingState.getState().dispatch
        increment(traceInProgressKey)
        await Z.timeoutPromise(durationSeconds * 1_000)
        decrement(traceInProgressKey)
      }
      Z.ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
