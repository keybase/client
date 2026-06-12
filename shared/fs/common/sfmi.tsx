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
import {useFsErrorActionOrThrow} from './error-state'
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

const makeInitialSfmiStateWithPermissionError = (initialKextPermissionError: boolean): SfmiState => {
  const initialState = makeInitialSfmiState()
  return initialKextPermissionError
    ? {
        ...initialState,
        driverStatus: {
          ...Constants.emptyDriverStatusDisabled,
          kextPermissionError: true,
        },
      }
    : initialState
}

const refreshDriverStatusImpl = async (
  previousDriverStatus: T.FS.DriverStatus,
  setDriverStatus: (driverStatus: T.FS.DriverStatus) => void,
  refreshMountDirs: (driverStatus: T.FS.DriverStatus) => Promise<{directMountDir: string}>,
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
) => {
  try {
    const previousType = previousDriverStatus.type
    const status = await refreshDriverStatusInPlatform()
    const refreshedDriverStatus = fuseStatusToDriverStatus(status)
    const driverStatus =
      previousDriverStatus.type === T.FS.DriverStatusType.Disabled &&
      previousDriverStatus.kextPermissionError &&
      refreshedDriverStatus.type === T.FS.DriverStatusType.Disabled
        ? {
            ...refreshedDriverStatus,
            kextPermissionError: true,
          }
        : refreshedDriverStatus
    setDriverStatus(driverStatus)
    const {directMountDir} = await refreshMountDirs(driverStatus)
    if (status?.kextStarted && previousType === T.FS.DriverStatusType.Disabled) {
      const path = T.FS.stringToPath('/keybase')
      try {
        await openPathInSystemFileManagerInPlatform(path, driverStatus, directMountDir)
      } catch (error) {
        errorToActionOrThrow(error, path)
      }
    }
  } catch (error) {
    errorToActionOrThrow(error)
  }
}

const driverEnableImpl = async (
  isRetry: boolean,
  driverKextPermissionError: () => void,
  refreshDriverStatus: () => Promise<void>,
  errorToActionOrThrow: (error: unknown) => void
) => {
  try {
    const result = await afterDriverEnabledInPlatform(isRetry)
    if (result === 'kextPermissionError' || result === 'kextPermissionErrorRetry') {
      driverKextPermissionError()
      if (result === 'kextPermissionError') {
        C.Router2.navigateAppend({name: 'kextPermission', params: {}})
      }
      return
    }
    await refreshDriverStatus()
    notifySfmiReload()
  } catch (error) {
    errorToActionOrThrow(error)
  }
}

export const SystemFileManagerIntegrationProvider = ({
  children,
  initialKextPermissionError = false,
}: {
  children: React.ReactNode
  initialKextPermissionError?: boolean
}) => {
  const connected = useKbfsDaemonStatus().rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected
  const defaultErrorToActionOrThrow = useFsErrorActionOrThrow()
  const appFocused = useShellState(s => s.appFocused)
  const [sfmiState, setSfmiState] = React.useState(() =>
    makeInitialSfmiStateWithPermissionError(initialKextPermissionError)
  )
  const appFocusedRef = React.useRef(appFocused)
  const sfmiStateRef = React.useRef(sfmiState)
  const [prevConnected, setPrevConnected] = React.useState(connected)
  const [prevKextError, setPrevKextError] = React.useState(initialKextPermissionError)

  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (!connected) {
      setSfmiState(makeInitialSfmiStateWithPermissionError(initialKextPermissionError))
    }
  }
  if (!connected && initialKextPermissionError !== prevKextError) {
    setPrevKextError(initialKextPermissionError)
    setSfmiState(makeInitialSfmiStateWithPermissionError(initialKextPermissionError))
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
    setSfmiState(s =>
      C.produce(s, draft => {
        draft.driverStatus = T.castDraft(driverStatus)
      })
    )
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
    await refreshDriverStatusImpl(
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

  const driverDisabling = React.useEffectEvent(() => {
    setSfmiState(s =>
      C.produce(s, draft => {
        if (draft.driverStatus.type === T.FS.DriverStatusType.Enabled) {
          draft.driverStatus.isDisabling = true
        }
      })
    )
    const f = async () => {
      await afterDriverDisablingInPlatform(sfmiStateRef.current.driverStatus)
      await refreshDriverStatus()
      notifySfmiReload()
    }
    C.ignorePromise(f())
  })

  const driverKextPermissionError = React.useEffectEvent(() => {
    setSfmiState(s =>
      C.produce(s, draft => {
        if (draft.driverStatus.type === T.FS.DriverStatusType.Disabled) {
          draft.driverStatus.kextPermissionError = true
          draft.driverStatus.isEnabling = false
        }
      })
    )
  })

  const driverDisable = React.useEffectEvent(() => {
    const f = async () => {
      setSfmiBannerDismissed(false)
      const result = await afterDriverDisableInPlatform(sfmiStateRef.current.driverStatus)
      if (result === 'disabling') {
        driverDisabling()
      } else if (result === 'refresh') {
        await refreshDriverStatus()
        notifySfmiReload()
      }
    }
    C.ignorePromise(f())
  })

  const driverEnable = React.useEffectEvent((isRetry?: boolean) => {
    const f = async () => {
      setSfmiState(s =>
        C.produce(s, draft => {
          if (draft.driverStatus.type === T.FS.DriverStatusType.Disabled) {
            draft.driverStatus.isEnabling = true
          }
        })
      )
      setSfmiBannerDismissed(false)
      await driverEnableImpl(!!isRetry, driverKextPermissionError, refreshDriverStatus, defaultErrorToActionOrThrow)
    }
    C.ignorePromise(f())
  })

  React.useEffect(() => {
    if (!connected) return
    loadSettings()
    refreshDriverStatusDesktop()
  }, [connected])

  React.useEffect(() => {
    const wasFocused = appFocusedRef.current
    appFocusedRef.current = appFocused
    if (wasFocused || !appFocused) {
      return
    }
    const {driverStatus} = sfmiStateRef.current
    if (
      driverStatus.type === T.FS.DriverStatusType.Disabled &&
      driverStatus.kextPermissionError
    ) {
      driverEnable(true)
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
    <SfmiContext.Provider
      value={{
        ...sfmiState,
        driverDisable,
        driverEnable,
        refreshDriverStatusDesktop,
        setSfmiBannerDismissed,
      }}
    >
      {children}
    </SfmiContext.Provider>
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
