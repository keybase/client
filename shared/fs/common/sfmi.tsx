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
import {useCurrentUserState} from '@/stores/current-user'

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

// The account epoch moves whenever the signed-in user changes. Async work keeps the account epoch it started in and
// touches state only while that is still current. The connection epoch moves whenever KBFS connects or
// disconnects and only gates status reads, so an enable that restarts KBFS still finishes as its own.
export type SfmiSession = {account: number; connected: boolean; connection: number}
export type SfmiStarted = Pick<SfmiSession, 'account' | 'connection'>

export const isSameAccount = (session: SfmiSession, startedAccount: number) => session.account === startedAccount

// The service also answers while KBFS is disconnected, with a status that does not hold once it is back.
export const canApplyStatus = (session: SfmiSession, started: SfmiStarted) =>
  session.connected && session.connection === started.connection && isSameAccount(session, started.account)

// 'disconnected': not read or not applied because KBFS was down, reconnected or the account changed meanwhile; a
// refresh once it is back re-reads. undefined: the refresh failed, and that is already reported.
export type DriverStatusRefresh = T.FS.DriverStatus | 'disconnected' | undefined

// On macOS enabling needs the user's own macFUSE, installed and up to date.
export const canEnableDriver = (driverStatus: T.FS.DriverStatus) =>
  driverStatus.type === T.FS.DriverStatusType.Enabled ||
  (driverStatus.type === T.FS.DriverStatusType.Disabled && driverStatus.macfuse === T.FS.MacfuseState.Ready)

export const mountPollIntervalMs = 1000
export const mountPollLimit = 30
export const disconnectedPollLimit = 60

// Enabled went through but the mount has not shown yet.
export const isMountPending = (driverStatus: DriverStatusRefresh): driverStatus is T.FS.DriverStatusDisabled =>
  typeof driverStatus === 'object' &&
  driverStatus.type === T.FS.DriverStatusType.Disabled &&
  driverStatus.macfuse === T.FS.MacfuseState.Ready

// KBFS connects before it mounts, so a user who turned Finder access on waits for the mount after a connect.
export const isFinderAccessMountPending = (driverStatus: DriverStatusRefresh) =>
  isMountPending(driverStatus) && driverStatus.finderAccessOn

// darwin is Enabled only once the mount shows in the status, and waitForMounts gives up after
// 10s without failing, so the mount can land after the enable call returns. Enabling restarts KBFS, so polling
// also waits through 'disconnected', on a budget of its own. Stops once stillCurrent fails. Returns the last result.
export const refreshUntilMounted = async (
  refreshDriverStatus: () => Promise<DriverStatusRefresh>,
  wait: (ms: number) => Promise<void>,
  stillCurrent: () => boolean,
  waitForMount: (driverStatus: DriverStatusRefresh) => boolean = isMountPending
) => {
  let pendingPolls = 0
  let disconnectedPolls = 0
  let driverStatus = await refreshDriverStatus()
  while (stillCurrent()) {
    if (waitForMount(driverStatus) && pendingPolls < mountPollLimit) {
      pendingPolls++
    } else if (driverStatus === 'disconnected' && disconnectedPolls < disconnectedPollLimit) {
      disconnectedPolls++
    } else {
      break
    }
    await wait(mountPollIntervalMs)
    if (!stillCurrent()) {
      break
    }
    driverStatus = await refreshDriverStatus()
  }
  return driverStatus
}

type DriverEnableParams = {
  enable: () => Promise<Awaited<ReturnType<typeof afterDriverEnabledInPlatform>>>
  mountStillPending: () => void
  openFinder: (driverStatus: T.FS.DriverStatus) => Promise<void>
  pollUntilMounted: boolean
  refreshDriverStatus: () => Promise<DriverStatusRefresh>
  setKextPermissionError: (kextPermissionError: boolean) => void
  stillCurrent: () => boolean
  wait: (ms: number) => Promise<void>
}

// Finder opens only here, once the user's own enable shows Enabled for the account that started it (D58).
export const driverEnableImpl = async (p: DriverEnableParams) => {
  const result = await p.enable()
  if (result === 'kextPermissionError' || result === 'kextPermissionErrorRetry') {
    p.setKextPermissionError(true)
    if (result === 'kextPermissionError') {
      C.Router2.navigateAppend({name: 'kextPermission', params: {}})
    }
    return
  }
  p.setKextPermissionError(false)
  const driverStatus = p.pollUntilMounted
    ? await refreshUntilMounted(p.refreshDriverStatus, p.wait, p.stillCurrent)
    : await p.refreshDriverStatus()
  if (p.stillCurrent() && typeof driverStatus === 'object') {
    if (driverStatus.type === T.FS.DriverStatusType.Enabled) {
      await p.openFinder(driverStatus)
    } else if (p.pollUntilMounted && isMountPending(driverStatus)) {
      p.mountStillPending()
    }
  }
  notifySfmiReload()
}

const driverDisableImpl = async (
  driverStatus: T.FS.DriverStatus,
  startDisabling: () => void,
  refreshDriverStatus: () => Promise<DriverStatusRefresh>
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
  const username = useCurrentUserState(s => s.username)
  const defaultErrorToActionOrThrow = useFsErrorActionOrThrow()
  const {redbar} = useFsRedbarActions()
  const {checkKbfsDaemonRpcStatus} = useFsDaemonActions()
  const appFocused = useShellState(s => s.appFocused)
  const [sfmiState, setSfmiState] = React.useState(makeInitialSfmiState)
  const appFocusedRef = React.useRef(appFocused)
  const sfmiStateRef = React.useRef(sfmiState)
  const sessionRef = React.useRef<SfmiSession>({account: 0, connected, connection: 0})
  // Set for the whole enable or disable, from the click on, so a second one cannot start meanwhile. Driver
  // operations are machine-wide, so it is held through an account switch until the operation ends.
  const driverBusyRef = React.useRef(false)
  // The operation the visible in-flight flags show, for the current account only.
  const operationRef = React.useRef<DriverOperation | undefined>(undefined)
  const [prevUsername, setPrevUsername] = React.useState(username)
  const [prevConnected, setPrevConnected] = React.useState(connected)

  if (username !== prevUsername) {
    setPrevUsername(username)
    setSfmiState(makeInitialSfmiState())
  }

  if (connected !== prevConnected) {
    setPrevConnected(connected)
    if (!connected) {
      // an enable restarts KBFS, so its pending note and in-flight flags carry over to the next connection
      setSfmiState(s => ({
        ...s,
        directMountDir: '',
        driverStatus: Constants.defaultDriverStatus,
        preferredMountDirs: [],
      }))
    }
  }

  // These run as the change commits, before any pending work can resume.
  React.useLayoutEffect(() => {
    sessionRef.current = {...sessionRef.current, account: sessionRef.current.account + 1}
    operationRef.current = undefined
  }, [username])

  React.useLayoutEffect(() => {
    sessionRef.current = {...sessionRef.current, connected, connection: sessionRef.current.connection + 1}
  }, [connected])

  React.useEffect(() => {
    sfmiStateRef.current = sfmiState
  }, [sfmiState])

  const isCurrent = (epoch: number) => isSameAccount(sessionRef.current, epoch)

  const loadSettings = React.useEffectEvent(() => {
    const epoch = sessionRef.current.account
    const f = async () => {
      try {
        const settings = await T.RPCGen.SimpleFSSimpleFSSettingsRpcPromise()
        if (!isCurrent(epoch)) {
          return
        }
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

  const refreshMountDirs = React.useEffectEvent(async (driverStatus: T.FS.DriverStatus, started: SfmiStarted) => {
    if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
      return
    }
    try {
      const {directMountDir, preferredMountDirs} = await refreshMountDirsInPlatform()
      if (canApplyStatus(sessionRef.current, started)) {
        setSfmiState(s =>
          C.produce(s, draft => {
            draft.directMountDir = directMountDir
            draft.preferredMountDirs = T.castDraft(preferredMountDirs)
          })
        )
      }
    } catch (error) {
      defaultErrorToActionOrThrow(error)
    }
  })

  const applyFuseStatus = React.useEffectEvent((status: T.RPCGen.FuseStatus | undefined, started: SfmiStarted) => {
    if (!canApplyStatus(sessionRef.current, started)) {
      return 'disconnected' as const
    }
    const driverStatus = fuseStatusToDriverStatus(status)
    const operation = operationRef.current
    const pending = isMountPending(driverStatus)
    setSfmiState(s => {
      const nextDriverStatus = withDriverOperation(keepKextPermissionError(s.driverStatus, driverStatus), operation)
      const mountPending = s.mountPending && pending
      return mountPending === s.mountPending && C.shallowEqual(nextDriverStatus, s.driverStatus)
        ? s
        : {...s, driverStatus: nextDriverStatus, mountPending}
    })
    return driverStatus
  })

  const readDriverStatus = React.useEffectEvent(async (): Promise<DriverStatusRefresh> => {
    const session = sessionRef.current
    // the answer would not apply, so there is no need to ask
    if (!session.connected) {
      return 'disconnected'
    }
    const started = {account: session.account, connection: session.connection}
    try {
      const driverStatus = applyFuseStatus(await refreshDriverStatusInPlatform(), started)
      if (driverStatus !== 'disconnected') {
        await refreshMountDirs(driverStatus, started)
      }
      return driverStatus
    } catch (error) {
      defaultErrorToActionOrThrow(error)
      return undefined
    }
  })

  const [refreshDriverStatus] = React.useState(() => singleFlight(async () => readDriverStatus()))

  // A user with Finder access on may connect before KBFS has mounted, so on connect the status is re-read until
  // the mount shows. There is no opt-in signal to tell them from a user with it off.
  const pollOnConnect = React.useEffectEvent(async () => {
    const {account, connection} = sessionRef.current
    return refreshUntilMounted(
      refreshDriverStatus,
      C.timeoutPromise,
      () => sessionRef.current.account === account && sessionRef.current.connection === connection,
      isFinderAccessMountPending
    )
  })

  const [refreshUntilMountedOnConnect] = React.useState(() => singleFlight(async () => pollOnConnect()))

  const refreshDriverStatusDesktop = React.useEffectEvent(() => C.ignorePromise(refreshDriverStatus()))

  const reloadSfmi = React.useEffectEvent((onConnect: boolean) => {
    if (!connected) {
      return
    }
    loadSettings()
    C.ignorePromise(onConnect && C.isDarwin ? refreshUntilMountedOnConnect() : refreshDriverStatus())
  })

  const setSfmiBannerDismissed = React.useEffectEvent((dismissed: boolean) => {
    const epoch = sessionRef.current.account
    const f = async () => {
      try {
        await setSfmiBannerDismissedInPlatform(dismissed)
        if (isCurrent(epoch)) {
          setSfmiState(s =>
            C.produce(s, draft => {
              draft.settingsLoaded = true
              draft.sfmiBannerDismissed = dismissed
            })
          )
        }
        notifySfmiReload()
      } catch (error) {
        defaultErrorToActionOrThrow(error)
      }
    }
    C.ignorePromise(f())
  })

  const reportDriverError = React.useEffectEvent((epoch: number, action: 'enable' | 'disable', error: unknown) => {
    if (!isCurrent(epoch)) {
      return
    }
    // a KBFS timeout shows as the daemon's status instead
    if (error instanceof RPCError && error.code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
      checkKbfsDaemonRpcStatus()
    } else {
      redbar(`Couldn't ${action} Keybase in ${C.fileUIName}: ${ensureError(error).message}`)
    }
    // a failure part way through can leave the status changed
    refreshDriverStatusDesktop()
  })

  const setKextPermissionError = React.useEffectEvent((epoch: number, kextPermissionError: boolean) => {
    if (!isCurrent(epoch)) {
      return
    }
    setSfmiState(s =>
      s.driverStatus.type === T.FS.DriverStatusType.Disabled &&
      !!s.driverStatus.kextPermissionError !== kextPermissionError
        ? {...s, driverStatus: {...s.driverStatus, kextPermissionError}}
        : s
    )
  })

  const clearMountPending = () => {
    setSfmiState(s => (s.mountPending ? {...s, mountPending: false} : s))
  }

  const mountStillPending = React.useEffectEvent(() => {
    // Decided from the applied status, which a refresh may have moved on since polling stopped. The kext error
    // already has its own prompt.
    setSfmiState(s =>
      isMountPending(s.driverStatus) && !s.driverStatus.kextPermissionError ? {...s, mountPending: true} : s
    )
  })

  const openFinder = React.useEffectEvent(async (epoch: number, driverStatus: T.FS.DriverStatus) => {
    const path = T.FS.stringToPath('/keybase')
    try {
      const {directMountDir} = await refreshMountDirsInPlatform()
      if (isCurrent(epoch)) {
        await openPathInSystemFileManagerInPlatform(path, driverStatus, directMountDir)
      }
    } catch (error) {
      defaultErrorToActionOrThrow(error, path)
    }
  })

  const startDisabling = React.useEffectEvent((epoch: number) => {
    if (isCurrent(epoch)) {
      setDriverOperation('disabling')
    }
  })

  const endDriverOperation = React.useEffectEvent((epoch: number) => {
    driverBusyRef.current = false
    if (isCurrent(epoch)) {
      setDriverOperation(undefined)
    }
  })

  const driverDisable = React.useEffectEvent(() => {
    if (driverBusyRef.current) {
      return
    }
    driverBusyRef.current = true
    const epoch = sessionRef.current.account
    clearMountPending()
    const {driverStatus} = sfmiStateRef.current
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () => driverDisableImpl(driverStatus, () => startDisabling(epoch), refreshDriverStatus),
        error => reportDriverError(epoch, 'disable', error),
        () => endDriverOperation(epoch)
      )
    )
  })

  const driverEnable = React.useEffectEvent((isRetry?: boolean) => {
    if (driverBusyRef.current || !canEnableDriver(sfmiStateRef.current.driverStatus)) {
      return
    }
    driverBusyRef.current = true
    const epoch = sessionRef.current.account
    clearMountPending()
    setDriverOperation('enabling')
    setSfmiBannerDismissed(false)
    C.ignorePromise(
      runDriverOperation(
        async () =>
          driverEnableImpl({
            enable: async () => afterDriverEnabledInPlatform(!!isRetry),
            mountStillPending: () => mountStillPending(),
            openFinder: async driverStatus => openFinder(epoch, driverStatus),
            pollUntilMounted: C.isDarwin,
            refreshDriverStatus,
            setKextPermissionError: kextPermissionError => setKextPermissionError(epoch, kextPermissionError),
            stillCurrent: () => isCurrent(epoch),
            wait: C.timeoutPromise,
          }),
        error => reportDriverError(epoch, 'enable', error),
        () => endDriverOperation(epoch)
      )
    )
  })

  React.useEffect(() => {
    reloadSfmi(true)
  }, [connected, username])

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
      reloadSfmi(false)
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

  // useEffectEvent functions change identity every render, so consumers get these, which never change and
  // are safe in effect deps.
  const [actions] = React.useState(() => ({
    driverDisable: () => driverDisable(),
    driverEnable: (isRetry?: boolean) => driverEnable(isRetry),
    refreshDriverStatusDesktop: () => refreshDriverStatusDesktop(),
    setSfmiBannerDismissed: (dismissed: boolean) => setSfmiBannerDismissed(dismissed),
  }))

  return (
    <SfmiContext value={{...sfmiState, ...actions}}>
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
