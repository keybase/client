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
import {ensureError} from '@/util/errors'
import {useKbfsDaemonStatus} from './daemon'
import {useEngineActionListener} from '@/engine/action-listener'
import {useShellState} from '@/stores/shell'

type SfmiState = T.FS.SystemFileManagerIntegration & {
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

const refreshDriverStatusImpl = async (
  previousDriverStatus: T.FS.DriverStatus,
  // returns whether this status is the change from Disabled to Enabled
  setDriverStatus: (driverStatus: T.FS.DriverStatus) => boolean,
  refreshMountDirs: (driverStatus: T.FS.DriverStatus) => Promise<{directMountDir: string}>,
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
): Promise<T.FS.DriverStatus | undefined> => {
  try {
    const status = await refreshDriverStatusInPlatform()
    const driverStatus = keepKextPermissionError(previousDriverStatus, fuseStatusToDriverStatus(status))
    const becameEnabled = setDriverStatus(driverStatus)
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

// darwin is Enabled only once the mount shows in the status, and waitForMounts gives up after
// 10s without failing, so the mount can land after the enable call returns.
export const refreshUntilMounted = async (
  refreshDriverStatus: () => Promise<T.FS.DriverStatus | undefined>,
  wait: (ms: number) => Promise<void>
) => {
  let polls = 0
  let driverStatus = await refreshDriverStatus()
  while (
    driverStatus?.type === T.FS.DriverStatusType.Disabled &&
    driverStatus.macfuse === T.FS.MacfuseState.Ready &&
    polls < mountPollLimit
  ) {
    polls++
    await wait(mountPollIntervalMs)
    driverStatus = await refreshDriverStatus()
  }
}

const driverEnableImpl = async (
  isRetry: boolean,
  driverKextPermissionError: () => void,
  refreshDriverStatus: () => Promise<T.FS.DriverStatus | undefined>
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
    await refreshUntilMounted(refreshDriverStatus, C.timeoutPromise)
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
  const appFocused = useShellState(s => s.appFocused)
  const [sfmiState, setSfmiState] = React.useState(makeInitialSfmiState)
  const appFocusedRef = React.useRef(appFocused)
  const sfmiStateRef = React.useRef(sfmiState)
  const operationRef = React.useRef<DriverOperation | undefined>(undefined)
  // Kept in step with every status set, so overlapping refreshes see one Disabled to Enabled change
  // and open Finder once.
  const driverStatusTypeRef = React.useRef(sfmiState.driverStatus.type)
  const [prevConnected, setPrevConnected] = React.useState(connected)

  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (!connected) {
      setSfmiState(makeInitialSfmiState())
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

  const setDriverStatus = (driverStatus: T.FS.DriverStatus) => {
    const becameEnabled =
      driverStatusTypeRef.current === T.FS.DriverStatusType.Disabled &&
      driverStatus.type === T.FS.DriverStatusType.Enabled
    driverStatusTypeRef.current = driverStatus.type
    const operation = operationRef.current
    setSfmiState(s => ({...s, driverStatus: withDriverOperation(driverStatus, operation)}))
    return becameEnabled
  }

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

  const refreshDriverStatus = React.useEffectEvent(async () => {
    return await refreshDriverStatusImpl(
      sfmiStateRef.current.driverStatus,
      setDriverStatus,
      refreshMountDirsDesktop,
      defaultErrorToActionOrThrow
    )
  })

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
    redbar(`Couldn't ${action} Keybase in ${C.fileUIName}: ${ensureError(error).message}`)
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

  const driverDisable = React.useEffectEvent(() => {
    if (operationRef.current) {
      return
    }
    const {driverStatus} = sfmiStateRef.current
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () => driverDisableImpl(driverStatus, () => setDriverOperation('disabling'), refreshDriverStatus),
        error => reportDriverError('disable', error),
        () => setDriverOperation(undefined)
      )
    )
  })

  const driverEnable = React.useEffectEvent((isRetry?: boolean) => {
    if (operationRef.current || !canEnableDriver(sfmiStateRef.current.driverStatus)) {
      return
    }
    setDriverOperation('enabling')
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () => driverEnableImpl(!!isRetry, driverKextPermissionError, refreshDriverStatus),
        error => reportDriverError('enable', error),
        () => setDriverOperation(undefined)
      )
    )
  })

  React.useEffect(() => {
    if (!connected) return
    // the status was reset to Unknown on disconnect
    driverStatusTypeRef.current = T.FS.DriverStatusType.Unknown
    loadSettings()
    refreshDriverStatusDesktop()
  }, [connected])

  React.useEffect(() => {
    const wasFocused = appFocusedRef.current
    appFocusedRef.current = appFocused
    if (wasFocused || !appFocused || operationRef.current) {
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
