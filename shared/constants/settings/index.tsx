import * as T from '../types'
import {ignorePromise, timeoutPromise} from '../utils'
import * as S from '../strings'
import {androidIsTestDevice, pprofDir} from '../platform'
import * as EngineGen from '@/actions/engine-gen-gen'
import openURL from '@/util/open-url'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import * as Tabs from '../tabs'
import logger from '@/logger'
import {storeRegistry} from '../store-registry'
import {processorProfileInProgressKey, traceInProgressKey} from './util'

export * from './util'

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
    onEngineIncomingImpl: (action: EngineGen.Actions) => void
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
export const useSettingsState = Z.createZustand<State>(set => {
  const maybeLoadAppLink = () => {
    storeRegistry.getState('settings-phone').then(settingsPhoneState => {
      const phones = settingsPhoneState.phones
      if (!phones || phones.size > 0) {
        return
      }
      storeRegistry.getState('config').then(configState => {
        if (maybeLoadAppLinkOnce || !configState.startup.link.endsWith('/phone-app')) {
          return
        }
        maybeLoadAppLinkOnce = true
        storeRegistry.getState('router').then(routerState => {
          routerState.dispatch.switchTab(Tabs.settingsTab)
          routerState.dispatch.navigateAppend('settingsAddPhone')
        })
      })
    })
  }

  const dispatch: State['dispatch'] = {
    checkPassword: passphrase => {
      set(s => {
        s.checkPasswordIsCorrect = undefined
      })
      const f = async () => {
        const res = await T.RPCGen.accountPassphraseCheckRpcPromise(
          {passphrase},
          S.waitingKeySettingsCheckPassword
        )
        set(s => {
          s.checkPasswordIsCorrect = res
        })
      }
      ignorePromise(f())
    },
    dbNuke: () => {
      const f = async () => {
        await T.RPCGen.ctlDbNukeRpcPromise(undefined, S.waitingKeySettingsGeneric)
      }
      ignorePromise(f())
    },
    deleteAccountForever: passphrase => {
      const f = async () => {
        const currentUserState = await storeRegistry.getState('current-user')
        const username = currentUserState.username

        if (!username) {
          throw new Error('Unable to delete account: no username set')
        }

        if (androidIsTestDevice) {
          return
        }

        await T.RPCGen.loginAccountDeleteRpcPromise({passphrase}, S.waitingKeySettingsGeneric)
        const configState = await storeRegistry.getState('config')
        configState.dispatch.setJustDeletedSelf(username)
        const routerState = await storeRegistry.getState('router')
        routerState.dispatch.clearModals()
        routerState.dispatch.navigateAppend(Tabs.loginTab)
      }
      ignorePromise(f())
    },
    loadLockdownMode: () => {
      const f = async () => {
        const configState = await storeRegistry.getState('config')
        if (!configState.loggedIn) {
          return
        }
        try {
          const result = await T.RPCGen.accountGetLockdownModeRpcPromise(undefined)
          set(s => {
            s.lockdownModeEnabled = result.status
          })
        } catch {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      ignorePromise(f())
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
      ignorePromise(f())
    },
    loadSettings: () => {
      const f = async () => {
        const configState = await storeRegistry.getState('config')
        if (!configState.loggedIn) {
          return
        }
        try {
          const settings = await T.RPCGen.userLoadMySettingsRpcPromise(
            undefined,
            S.waitingKeySettingsLoadSettings
          )
          const settingsEmailState = await storeRegistry.getState('settings-email')
          settingsEmailState.dispatch.notifyEmailAddressEmailsChanged(settings.emails ?? [])
          const settingsPhoneState = await storeRegistry.getState('settings-phone')
          settingsPhoneState.dispatch.setNumbers(settings.phoneNumbers ?? undefined)
          maybeLoadAppLink()
        } catch (error) {
          if (!(error instanceof RPCError)) {
            return
          }
          logger.warn(`Error loading settings: ${error.message}`)
          return
        }
      }
      ignorePromise(f())
    },
    loginBrowserViaWebAuthToken: () => {
      const f = async () => {
        const link = await T.RPCGen.configGenerateWebAuthTokenRpcPromise()
        openURL(link)
      }
      ignorePromise(f())
    },
    onEngineIncomingImpl: action => {
      switch (action.type) {
        case EngineGen.keybase1NotifyEmailAddressEmailAddressVerified:
          logger.info('email verified')
          storeRegistry.getState('settings-email').then(settingsEmailState => {
            settingsEmailState.dispatch.notifyEmailVerified(action.payload.params.emailAddress)
          })
          break
        case EngineGen.keybase1NotifyUsersPasswordChanged: {
          const randomPW = action.payload.params.state === T.RPCGen.PassphraseState.random
          storeRegistry.getState('settings-password').then(settingsPasswordState => {
            settingsPasswordState.dispatch.notifyUsersPasswordChanged(randomPW)
          })
          break
        }
        case EngineGen.keybase1NotifyPhoneNumberPhoneNumbersChanged: {
          const {list} = action.payload.params
          storeRegistry.getState('settings-phone').then(settingsPhoneState => {
            settingsPhoneState.dispatch.notifyPhoneNumberPhoneNumbersChanged(list ?? undefined)
          })
          break
        }
        case EngineGen.keybase1NotifyEmailAddressEmailsChanged: {
          const list = action.payload.params.list ?? []
          storeRegistry.getState('settings-email').then(settingsEmailState => {
            settingsEmailState.dispatch.notifyEmailAddressEmailsChanged(list)
          })
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
        const waitingState = await storeRegistry.getState('waiting')
        const {decrement, increment} = waitingState.dispatch
        increment(processorProfileInProgressKey)
        await timeoutPromise(profileDurationSeconds * 1_000)
        decrement(processorProfileInProgressKey)
      }
      ignorePromise(f())
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
        const configState = await storeRegistry.getState('config')
        if (!configState.loggedIn) {
          return
        }
        try {
          await T.RPCGen.accountSetLockdownModeRpcPromise({enabled}, S.waitingKeySettingsSetLockdownMode)
          set(s => {
            s.lockdownModeEnabled = enabled
          })
        } catch {
          set(s => {
            s.lockdownModeEnabled = undefined
          })
        }
      }
      ignorePromise(f())
    },
    setProxyData: proxyData => {
      const f = async () => {
        try {
          await T.RPCGen.configSetProxyDataRpcPromise({proxyData})
        } catch (err) {
          logger.warn('Error in saving proxy data', err)
        }
      }
      ignorePromise(f())
    },
    stop: exitCode => {
      const f = async () => {
        await T.RPCGen.ctlStopRpcPromise({exitCode})
      }
      ignorePromise(f())
    },
    trace: durationSeconds => {
      const f = async () => {
        await T.RPCGen.pprofLogTraceRpcPromise({
          logDirForMobile: pprofDir,
          traceDurationSeconds: durationSeconds,
        })
        const waitingState = await storeRegistry.getState('waiting')
        const {decrement, increment} = waitingState.dispatch
        increment(traceInProgressKey)
        await timeoutPromise(durationSeconds * 1_000)
        decrement(traceInProgressKey)
      }
      ignorePromise(f())
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
