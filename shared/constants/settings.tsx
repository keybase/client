import * as C from '.'
import {useRouterState} from '.'
import * as RPCTypes from './types/rpc-gen'
import * as EngineGen from '../actions/engine-gen-gen'
import openURL from '../util/open-url'
import * as Z from '../util/zustand'
import {RPCError} from '../util/errors'
import {useConfigState} from './config'
import * as Tabs from './tabs'
import logger from '../logger'
import {pprofDir} from '../constants/platform'
import {_useState as usePhoneState} from './settings-phone'
import {_useState as useEmailState} from './settings-email'
import {_useState as usePasswordState} from './settings-password'

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
    setProxyData: (proxyData: RPCTypes.ProxyData) => void
    stop: (exitCode: RPCTypes.ExitCode) => void
    trace: (durationSeconds: number) => void
  }
}

let maybeLoadAppLinkOnce = false
export const _useState = Z.createZustand<State>(set => {
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
    useRouterState.getState().dispatch.switchTab(Tabs.settingsTab)
    useRouterState.getState().dispatch.navigateAppend('settingsAddPhone')
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
    dbNuke: () => {
      const f = async () => {
        await RPCTypes.ctlDbNukeRpcPromise(undefined, settingsWaitingKey)
      }
      Z.ignorePromise(f())
    },
    deleteAccountForever: passphrase => {
      const f = async () => {
        const username = C.useCurrentUserState.getState().username

        if (!username) {
          throw new Error('Unable to delete account: no username set')
        }

        await RPCTypes.loginAccountDeleteRpcPromise({passphrase}, settingsWaitingKey)
        useConfigState.getState().dispatch.setJustDeletedSelf(username)
        useRouterState.getState().dispatch.navigateAppend(Tabs.loginTab)
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
          useEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(settings.emails ?? [])
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
    loginBrowserViaWebAuthToken: () => {
      const f = async () => {
        const link = await RPCTypes.configGenerateWebAuthTokenRpcPromise()
        openURL(link)
      }
      Z.ignorePromise(f())
    },
    onEngineIncoming: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
          logger.info('email verified')
          useEmailState.getState().dispatch.notifyEmailVerified(action.payload.params.emailAddress)
          break
        case EngineGen.keybase1NotifyUsersPasswordChanged: {
          const randomPW = action.payload.params.state === RPCTypes.PassphraseState.random
          usePasswordState.getState().dispatch.notifyUsersPasswordChanged(randomPW)
          break
        }
        case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged: {
          const {list} = action.payload.params
          usePhoneState.getState().dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
          break
        }
        case EngineGen.keybase1NotifyEmailAddressEmailsChanged: {
          const list = action.payload.params.list ?? []
          useEmailState.getState().dispatch.notifyEmailAddressEmailsChanged(list)
          break
        }
        default:
      }
    },
    processorProfile: profileDurationSeconds => {
      const f = async () => {
        await RPCTypes.pprofLogProcessorProfileRpcPromise({
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
    stop: exitCode => {
      const f = async () => {
        await RPCTypes.ctlStopRpcPromise({exitCode})
      }
      Z.ignorePromise(f())
    },
    trace: durationSeconds => {
      const f = async () => {
        await RPCTypes.pprofLogTraceRpcPromise({
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
