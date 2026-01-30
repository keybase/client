import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import {androidIsTestDevice, pprofDir} from '@/constants/platform'
import openURL from '@/util/open-url'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import {clearModals, navigateAppend, switchTab} from '@/constants/router2'
import {useConfigState} from '@/stores/config'
import {useCurrentUserState} from '@/stores/current-user'
import {useWaitingState} from '@/stores/waiting'
import {processorProfileInProgressKey, traceInProgressKey} from '@/constants/settings'
import type {PhoneRow} from '@/stores/settings-phone'

export * from '@/constants/settings'

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
    clearLogs: () => void
    dbNuke: () => void
    defer: {
      getSettingsPhonePhones: () => undefined | ReadonlyMap<string, PhoneRow>
      onSettingsEmailNotifyEmailsChanged: (list: ReadonlyArray<T.RPCChat.Keybase1.Email>) => void
      onSettingsPhoneSetNumbers: (phoneNumbers?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
    }
    deleteAccountForever: (passphrase?: string) => void
    loadLockdownMode: () => void
    loadProxyData: () => void
    loadSettings: () => void
    loginBrowserViaWebAuthToken: () => void
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
export const useSettingsState = Z.createZustand<State>((set, get) => {
  const maybeLoadAppLink = () => {
    const phones = get().dispatch.defer.getSettingsPhonePhones()
    if (!phones || phones.size > 0) {
      return
    }

    if (maybeLoadAppLinkOnce || !useConfigState.getState().startup.link.endsWith('/phone-app')) {
      return
    }
    maybeLoadAppLinkOnce = true
    switchTab(Tabs.settingsTab)
    navigateAppend('settingsAddPhone')
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
    clearLogs: () => {
      const f = async () => {
        const clearLocalLogs = (await import('@/util/clear-logs')).default
        await clearLocalLogs()
      }
      ignorePromise(f())
    },
    dbNuke: () => {
      const f = async () => {
        await T.RPCGen.ctlDbNukeRpcPromise(undefined, S.waitingKeySettingsGeneric)
      }
      ignorePromise(f())
    },
    defer: {
      getSettingsPhonePhones: () => {
        throw new Error('getSettingsPhonePhones not implemented')
      },
      onSettingsEmailNotifyEmailsChanged: () => {
        throw new Error('onSettingsEmailNotifyEmailsChanged not implemented')
      },
      onSettingsPhoneSetNumbers: () => {
        throw new Error('onSettingsPhoneSetNumbers not implemented')
      },
    },
    deleteAccountForever: passphrase => {
      const f = async () => {
        const username = useCurrentUserState.getState().username

        if (!username) {
          throw new Error('Unable to delete account: no username set')
        }

        if (androidIsTestDevice) {
          return
        }

        await T.RPCGen.loginAccountDeleteRpcPromise({passphrase}, S.waitingKeySettingsGeneric)
        useConfigState.getState().dispatch.setJustDeletedSelf(username)
        clearModals()
        navigateAppend(Tabs.loginTab)
      }
      ignorePromise(f())
    },
    loadLockdownMode: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
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
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const settings = await T.RPCGen.userLoadMySettingsRpcPromise(
            undefined,
            S.waitingKeySettingsLoadSettings
          )
          get().dispatch.defer.onSettingsEmailNotifyEmailsChanged(settings.emails ?? [])
          get().dispatch.defer.onSettingsPhoneSetNumbers(settings.phoneNumbers ?? undefined)
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
    processorProfile: profileDurationSeconds => {
      const f = async () => {
        await T.RPCGen.pprofLogProcessorProfileRpcPromise({
          logDirForMobile: pprofDir,
          profileDurationSeconds,
        })
        const {decrement, increment} = useWaitingState.getState().dispatch
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
        if (!useConfigState.getState().loggedIn) {
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
        const {decrement, increment} = useWaitingState.getState().dispatch
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
