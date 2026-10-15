import * as C from '@/constants'
import * as Constants from '@/constants/fs'
import * as React from 'react'
import * as T from '@/constants/types'
import {
  afterDriverDisableDesktop as afterDriverDisableInPlatform,
  afterDriverDisablingDesktop as afterDriverDisablingInPlatform,
  afterDriverEnabledDesktop as afterDriverEnabledInPlatform,
  fuseStatusToDriverStatus,
  openPathInSystemFileManagerDesktop as openPathInSystemFileManagerInPlatform,
  refreshDriverStatusDesktop as refreshDriverStatusInPlatform,
  refreshMountDirsDesktop as refreshMountDirsInPlatform,
  setSfmiBannerDismissedDesktop as setSfmiBannerDismissedInPlatform,
} from '@/util/fs-platform'
import {clientID as fsClientID} from './client'
import {useFsErrorActionOrThrow, useFsRedbarActions} from './error-state'
import {RPCError, ensureError} from '@/util/errors'
import {useFsDaemonActions, useKbfsDaemonStatus} from './daemon'
import {useEngineActionListener} from '@/engine/action-listener'
import {useShellState} from '@/stores/shell'

type SfmiState = T.FS.SystemFileManagerIntegration & {
  // an enable stopped waiting for the mount, and it still has not appeared
  mountPending: boolean
  settingsLoaded: boolean
  sfmiBannerDismissed: boolean
}

type SfmiContextType = SfmiState & {
  driverDisable: () => void
  driverEnable: (isRetry?: boolean) => void
  refreshDriverStatusDesktop: () => void
  setSfmiBannerDismissed: (dismissed: boolean) => void
}

const makeInitialSfmiState = (): SfmiState => ({
  directMountDir: '',
  driverStatus: Constants.defaultDriverStatus,
  mountPending: false,
  preferredMountDirs: [],
  settingsLoaded: false,
  sfmiBannerDismissed: false,
})

const SfmiContext = React.createContext<SfmiContextType | null>(null)
const sfmiReloadListeners = new Set<() => void>()

const notifySfmiReload = () => {
  sfmiReloadListeners.forEach(listener => {
    listener()
  })
}

// The status cannot tell an unapproved kext from one that is just not loaded yet, so a kext
// error from enabling holds while macFUSE stays otherwise ready.
export const keepKextPermissionError = (
  previous: T.FS.DriverStatus,
  refreshed: T.FS.DriverStatus
): T.FS.DriverStatus =>
  previous.type === T.FS.DriverStatusType.Disabled &&
  previous.kextPermissionError &&
  refreshed.type === T.FS.DriverStatusType.Disabled &&
  refreshed.macfuse === T.FS.MacfuseState.Ready
    ? {...refreshed, kextPermissionError: true}
    : refreshed

export type DriverOperation = 'enabling' | 'disabling'

// The in-flight flags belong to the running enable or disable, so a status refresh in the middle
// of one cannot make the switch clickable again.
export const withDriverOperation = (
  driverStatus: T.FS.DriverStatus,
  operation: DriverOperation | undefined
): T.FS.DriverStatus => {
  switch (driverStatus.type) {
    case T.FS.DriverStatusType.Disabled: {
      const isEnabling = operation === 'enabling'
      return driverStatus.isEnabling === isEnabling ? driverStatus : {...driverStatus, isEnabling}
    }
    case T.FS.DriverStatusType.Enabled: {
      const isDisabling = operation === 'disabling'
      return driverStatus.isDisabling === isDisabling ? driverStatus : {...driverStatus, isDisabling}
    }
    default:
      return driverStatus
  }
}

// At most one run at a time. A call while one runs gets the result of one more run after it, which every
// call made meanwhile shares, so each caller sees a run that started after its call.
export const singleFlight = <R,>(run: () => Promise<R>): (() => Promise<R>) => {
  let flight: Promise<R> | undefined
  let calls = 0
  const loop = async () => {
    try {
      for (;;) {
        const callsBefore = calls
        try {
          const result = await run()
          if (calls === callsBefore) return result
        } catch (error) {
          if (calls === callsBefore) throw error
        }
      }
    } finally {
      flight = undefined
    }
  }
  return async () => {
    calls++
    flight ??= loop()
    return flight
  }
}

const refreshDriverStatusImpl = async (
  applyFuseStatus: (
    status: T.RPCGen.FuseStatus | undefined
  ) => {becameEnabled: boolean; driverStatus: T.FS.DriverStatus} | undefined,
  refreshMountDirs: (driverStatus: T.FS.DriverStatus) => Promise<{directMountDir: string}>,
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
): Promise<T.FS.DriverStatus | undefined> => {
  try {
    const applied = applyFuseStatus(await refreshDriverStatusInPlatform())
    if (!applied) {
      return undefined
    }
    const {becameEnabled, driverStatus} = applied
    const {directMountDir} = await refreshMountDirs(driverStatus)
    if (becameEnabled) {
      const path = T.FS.stringToPath('/keybase')
      try {
        await openPathInSystemFileManagerInPlatform(path, driverStatus, directMountDir)
      } catch (error) {
        errorToActionOrThrow(error, path)
      }
    }
    return driverStatus
  } catch (error) {
    errorToActionOrThrow(error)
    return undefined
  }
}

// On macOS enabling needs the user's own macFUSE, installed and up to date.
export const canEnableDriver = (driverStatus: T.FS.DriverStatus) =>
  driverStatus.type !== T.FS.DriverStatusType.Disabled || driverStatus.macfuse === T.FS.MacfuseState.Ready

export const mountPollIntervalMs = 1000
export const mountPollLimit = 30

// Enabled went through but the mount has not shown yet. A refresh that failed (already reported) or ended while
// KBFS was disconnected is undefined.
export const isMountPending = (
  driverStatus: T.FS.DriverStatus | undefined
): driverStatus is T.FS.DriverStatusDisabled =>
  driverStatus?.type === T.FS.DriverStatusType.Disabled && driverStatus.macfuse === T.FS.MacfuseState.Ready

// darwin is Enabled only once the mount shows in the status, and waitForMounts gives up after
// 10s without failing, so the mount can land after the enable call returns. Returns the last status.
export const refreshUntilMounted = async (
  refreshDriverStatus: () => Promise<T.FS.DriverStatus | undefined>,
  wait: (ms: number) => Promise<void>
) => {
  let polls = 0
  let driverStatus = await refreshDriverStatus()
  while (isMountPending(driverStatus) && polls < mountPollLimit) {
    polls++
    await wait(mountPollIntervalMs)
    driverStatus = await refreshDriverStatus()
  }
  return driverStatus
}

const driverEnableImpl = async (
  isRetry: boolean,
  driverKextPermissionError: () => void,
  refreshDriverStatus: () => Promise<T.FS.DriverStatus | undefined>,
  mountStillPending: () => void
) => {
  const result = await afterDriverEnabledInPlatform(isRetry)
  if (result === 'kextPermissionError' || result === 'kextPermissionErrorRetry') {
    driverKextPermissionError()
    if (result === 'kextPermissionError') {
      C.Router2.navigateAppend({name: 'kextPermission', params: {}})
    }
    return
  }
  if (C.isDarwin) {
    const driverStatus = await refreshUntilMounted(refreshDriverStatus, C.timeoutPromise)
    // the kext error already has its own prompt
    if (isMountPending(driverStatus) && !driverStatus.kextPermissionError) {
      mountStillPending()
    }
  } else {
    await refreshDriverStatus()
  }
  notifySfmiReload()
}

const driverDisableImpl = async (
  driverStatus: T.FS.DriverStatus,
  startDisabling: () => void,
  refreshDriverStatus: () => Promise<T.FS.DriverStatus | undefined>
) => {
  const result = await afterDriverDisableInPlatform(driverStatus)
  if (result === 'noop') {
    return
  }
  if (result === 'disabling') {
    startDisabling()
    await afterDriverDisablingInPlatform(driverStatus)
  }
  await refreshDriverStatus()
  notifySfmiReload()
}

export const runDriverOperation = async (
  operation: () => Promise<void>,
  onError: (error: unknown) => void,
  end: () => void
) => {
  try {
    await operation()
  } catch (error) {
    onError(error)
  } finally {
    end()
  }
}

export const SystemFileManagerIntegrationProvider = ({children}: {children: React.ReactNode}) => {
  const connected = useKbfsDaemonStatus().rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected
  const defaultErrorToActionOrThrow = useFsErrorActionOrThrow()
  const {redbar} = useFsRedbarActions()
  const {checkKbfsDaemonRpcStatus} = useFsDaemonActions()
  // Updated as each render commits, before any pending refresh can resume, so a status is never applied after
  // a disconnect has rendered.
  const connectedRef = React.useRef(connected)
  React.useLayoutEffect(() => {
    connectedRef.current = connected
  }, [connected])
  const appFocused = useShellState(s => s.appFocused)
  const [sfmiState, setSfmiState] = React.useState(makeInitialSfmiState)
  const appFocusedRef = React.useRef(appFocused)
  const sfmiStateRef = React.useRef(sfmiState)
  // Set for the whole enable or disable, from the click on, so a second one cannot start meanwhile.
  const driverBusyRef = React.useRef(false)
  // The operation the visible in-flight flags show.
  const operationRef = React.useRef<DriverOperation | undefined>(undefined)
  // The last known status type, kept through a KBFS reconnect so an enable across one still opens Finder.
  const lastStatusTypeRef = React.useRef(sfmiState.driverStatus.type)
  const [prevConnected, setPrevConnected] = React.useState(connected)

  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (!connected) {
      // the mount can still land after KBFS comes back
      setSfmiState(s => ({...makeInitialSfmiState(), mountPending: s.mountPending}))
    }
  }

  React.useEffect(() => {
    sfmiStateRef.current = sfmiState
  }, [sfmiState])

  const loadSettings = React.useEffectEvent(() => {
    const f = async () => {
      try {
        const settings = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
        setSfmiState(s =>
          C.produce(s, draft => {
            draft.settingsLoaded = true
            draft.sfmiBannerDismissed = settings.sfmiBannerDismissed
          })
        )
      } catch {}
    }
    C.ignorePromise(f())
  })

  const setDriverOperation = (operation: DriverOperation | undefined) => {
    operationRef.current = operation
    setSfmiState(s => ({...s, driverStatus: withDriverOperation(s.driverStatus, operation)}))
  }

  const setMountDirs = (directMountDir: string, preferredMountDirs: ReadonlyArray<string>) => {
    setSfmiState(s =>
      C.produce(s, draft => {
        draft.directMountDir = directMountDir
        draft.preferredMountDirs = T.castDraft(preferredMountDirs)
      })
    )
  }

  const refreshMountDirsDesktop = React.useEffectEvent(async (driverStatus: T.FS.DriverStatus) => {
    if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
      return {
        directMountDir: sfmiStateRef.current.directMountDir,
        preferredMountDirs: sfmiStateRef.current.preferredMountDirs,
      }
    }
    try {
      const {directMountDir, preferredMountDirs} = await refreshMountDirsInPlatform()
      setMountDirs(directMountDir, preferredMountDirs)
      return {directMountDir, preferredMountDirs}
    } catch (error) {
      defaultErrorToActionOrThrow(error)
      return {
        directMountDir: sfmiStateRef.current.directMountDir,
        preferredMountDirs: sfmiStateRef.current.preferredMountDirs,
      }
    }
  })

  // undefined while KBFS is disconnected: the service answers then, with a status that does not hold once it is back
  const applyFuseStatus = React.useEffectEvent((status: T.RPCGen.FuseStatus | undefined) => {
    if (!connectedRef.current) {
      return undefined
    }
    const driverStatus = keepKextPermissionError(sfmiStateRef.current.driverStatus, fuseStatusToDriverStatus(status))
    const becameEnabled =
      lastStatusTypeRef.current === T.FS.DriverStatusType.Disabled &&
      driverStatus.type === T.FS.DriverStatusType.Enabled
    if (driverStatus.type !== T.FS.DriverStatusType.Unknown) {
      lastStatusTypeRef.current = driverStatus.type
    }
    const operation = operationRef.current
    const pending = isMountPending(driverStatus)
    setSfmiState(s => ({
      ...s,
      driverStatus: withDriverOperation(driverStatus, operation),
      mountPending: s.mountPending && pending,
    }))
    return {becameEnabled, driverStatus}
  })

  const [refreshDriverStatus] = React.useState(() => singleFlight(async () =>
      refreshDriverStatusImpl(applyFuseStatus, refreshMountDirsDesktop, defaultErrorToActionOrThrow)
    ))

  const refreshDriverStatusDesktop = React.useEffectEvent(() => {
    const f = async () => {
      await refreshDriverStatus()
    }
    C.ignorePromise(f())
  })

  const reloadSfmi = React.useEffectEvent(() => {
    if (!connected) {
      return
    }
    loadSettings()
    refreshDriverStatusDesktop()
  })

  const setSfmiBannerDismissed = React.useEffectEvent((dismissed: boolean) => {
    const f = async () => {
      try {
        await setSfmiBannerDismissedInPlatform(dismissed)
        setSfmiState(s =>
          C.produce(s, draft => {
            draft.settingsLoaded = true
            draft.sfmiBannerDismissed = dismissed
          })
        )
        notifySfmiReload()
      } catch (error) {
        defaultErrorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  })

  const reportDriverError = React.useEffectEvent((action: 'enable' | 'disable', error: unknown) => {
    // a KBFS timeout shows as the daemon's status instead
    if (error instanceof RPCError && error.code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
      checkKbfsDaemonRpcStatus()
    } else {
      redbar(`Couldn't ${action} Keybase in ${C.fileUIName}: ${ensureError(error).message}`)
    }
    // a failure part way through can leave the status changed
    refreshDriverStatusDesktop()
  })

  const driverKextPermissionError = React.useEffectEvent(() => {
    setSfmiState(s =>
      C.produce(s, draft => {
        if (draft.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          draft.driverStatus.kextPermissionError = true
        }
      })
    )
  })

  const clearMountPending = () => {
    setSfmiState(s => (s.mountPending ? {...s, mountPending: false} : s))
  }

  const mountStillPending = React.useEffectEvent(() => {
    // decided from the applied status, which a refresh may have moved on since polling stopped
    setSfmiState(s => (isMountPending(s.driverStatus) ? {...s, mountPending: true} : s))
  })

  const endDriverOperation = () => {
    driverBusyRef.current = false
    setDriverOperation(undefined)
  }

  const driverDisable = React.useEffectEvent(() => {
    if (driverBusyRef.current) {
      return
    }
    driverBusyRef.current = true
    clearMountPending()
    const {driverStatus} = sfmiStateRef.current
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () => driverDisableImpl(driverStatus, () => setDriverOperation('disabling'), refreshDriverStatus),
        error => reportDriverError('disable', error),
        endDriverOperation
      )
    )
  })

  const driverEnable = React.useEffectEvent((isRetry?: boolean) => {
    if (driverBusyRef.current || !canEnableDriver(sfmiStateRef.current.driverStatus)) {
      return
    }
    driverBusyRef.current = true
    clearMountPending()
    setDriverOperation('enabling')
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () =>
          driverEnableImpl(!!isRetry, driverKextPermissionError, refreshDriverStatus, mountStillPending),
        error => reportDriverError('enable', error),
        endDriverOperation
      )
    )
  })

  React.useEffect(() => {
    if (!connected) return
    loadSettings()
    refreshDriverStatusDesktop()
  }, [connected])

  React.useEffect(() => {
    const wasFocused = appFocusedRef.current
    appFocusedRef.current = appFocused
    if (wasFocused || !appFocused || driverBusyRef.current) {
      return
    }
    const {driverStatus} = sfmiStateRef.current
    if (driverStatus.type !== T.FS.DriverStatusType.Disabled) {
      return
    }
    if (driverStatus.kextPermissionError) {
      driverEnable(true)
    } else {
      // the user may have just installed or updated macFUSE, or a mount may have landed after
      // enabling stopped waiting for it
      refreshDriverStatusDesktop()
    }
  }, [appFocused])

  React.useEffect(() => {
    const listener = () => {
      reloadSfmi()
    }
    sfmiReloadListeners.add(listener)
    return () => {
      sfmiReloadListeners.delete(listener)
    }
  }, [])

  useEngineActionListener(
    'keybase.1.NotifyFS.FSSubscriptionNotify',
    action => {
      const {clientID, topic} = action.payload.params
      if (clientID === fsClientID && topic === T.RPCGen.SubscriptionTopic.settings) {
        loadSettings()
      }
    },
    connected
  )

  return (
    <SfmiContext
      value={{
        ...sfmiState,
        driverDisable,
        driverEnable,
        refreshDriverStatusDesktop,
        setSfmiBannerDismissed,
      }}
    >
      {children}
    </SfmiContext>
  )
}

export const useSystemFileManagerIntegration = () => {
  const sfmi = React.useContext(SfmiContext)
  if (!sfmi) {
    throw new Error('useSystemFileManagerIntegration must be used inside SystemFileManagerIntegrationProvider')
  }
  return sfmi
}

export const useOpenPathInSystemFileManagerDesktop = () => {
  const {directMountDir, driverStatus} = useSystemFileManagerIntegration()
  const defaultErrorToActionOrThrow = useFsErrorActionOrThrow()
  return (
    path: T.FS.Path,
    onErrorOrThrow: (error: unknown, path?: T.FS.Path) => void = defaultErrorToActionOrThrow
  ) => {
    const f = async () => {
      try {
        await openPathInSystemFileManagerInPlatform(path, driverStatus, directMountDir)
      } catch (error) {
        onErrorOrThrow(error, path)
      }
    }
    C.ignorePromise(f())
  }
}
