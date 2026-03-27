import * as T from '@/constants/types'
import {ignorePromise, timeoutPromise} from '@/constants/utils'
import * as S from '@/constants/strings'
import {pprofDir} from '@/constants/platform'
import {openURL} from '@/util/misc'
import * as Z from '@/util/zustand'
import {RPCError} from '@/util/errors'
import * as Tabs from '@/constants/tabs'
import logger from '@/logger'
import {switchTab, navigateAppend} from '@/constants/router'
import {useConfigState} from '@/stores/config'
import {useWaitingState} from '@/stores/waiting'
import {processorProfileInProgressKey, traceInProgressKey} from '@/constants/settings'
import type {PhoneRow} from '@/stores/settings-phone'

export * from '@/constants/settings'

type Store = T.Immutable<{
  lockdownModeEnabled?: boolean
}>

const initialStore: Store = {
  lockdownModeEnabled: undefined,
}

export type State = Store & {
  dispatch: {
    clearLogs: () => void
    dbNuke: () => void
    defer: {
      getSettingsPhonePhones: () => undefined | ReadonlyMap<string, PhoneRow>
      onSettingsEmailNotifyEmailsChanged: (list: ReadonlyArray<T.RPCChat.Keybase1.Email>) => void
      onSettingsPhoneSetNumbers: (phoneNumbers?: ReadonlyArray<T.RPCChat.Keybase1.UserPhoneNumber>) => void
    }
    loadLockdownMode: () => void
    loadSettings: () => void
    loginBrowserViaWebAuthToken: () => void
    processorProfile: (durationSeconds: number) => void
    resetState: () => void
    setLockdownMode: (l: boolean) => void
    stop: (exitCode: T.RPCGen.ExitCode) => void
    trace: (durationSeconds: number) => void
  }
}

const runPprofAction = (
  rpc: () => Promise<void>,
  waitingKey: string,
  durationSeconds: number
) => {
  const f = async () => {
    await rpc()
    const {decrement, increment} = useWaitingState.getState().dispatch
    increment(waitingKey)
    await timeoutPromise(durationSeconds * 1_000)
    decrement(waitingKey)
  }
  ignorePromise(f())
}

let maybeLoadAppLinkOnce = false
export const useSettingsState = Z.createZustand<State>('settings', (set, get) => {
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
    clearLogs: () => {
      const f = async () => {
        const {clearLocalLogs} = await import('@/util/misc')
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
    loadLockdownMode: () => {
      const f = async () => {
        if (!useConfigState.getState().loggedIn) {
          return
        }
        try {
          const result = await T.RPCGen.accountGetLockdownModeRpcPromise()
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
    processorProfile: durationSeconds => {
      runPprofAction(
        async () =>
          T.RPCGen.pprofLogProcessorProfileRpcPromise({
            logDirForMobile: pprofDir,
            profileDurationSeconds: durationSeconds,
          }),
        processorProfileInProgressKey,
        durationSeconds
      )
    },
    resetState: Z.defaultReset,
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
    stop: exitCode => {
      const f = async () => {
        await T.RPCGen.ctlStopRpcPromise({exitCode})
      }
      ignorePromise(f())
    },
    trace: durationSeconds => {
      runPprofAction(
        async () =>
          T.RPCGen.pprofLogTraceRpcPromise({
            logDirForMobile: pprofDir,
            traceDurationSeconds: durationSeconds,
          }),
        traceInProgressKey,
        durationSeconds
      )
    },
  }
  return {
    ...initialStore,
    dispatch,
  }
})
