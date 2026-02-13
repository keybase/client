// links all the stores together, stores never import this
import * as Chat from '@/stores/chat2'
import {ignorePromise} from '@/constants/utils'
import {useConfigState} from '@/stores/config'
import * as ConfigConstants from '@/stores/config'
import {useDaemonState} from '@/stores/daemon'
import {useFSState} from '@/stores/fs'
import {useProfileState} from '@/stores/profile'
import {useRouterState} from '@/stores/router2'
import * as EngineGen from '@/actions/engine-gen-gen'
import * as T from '@/constants/types'
import InputMonitor from '@/util/platform-specific/input-monitor.desktop'
import KB2 from '@/util/electron.desktop'
import logger from '@/logger'
import type {RPCError} from '@/util/errors'
import {getEngine} from '@/engine'
import {isLinux, isWindows, isDarwin, pathSep} from '@/constants/platform.desktop'
import {kbfsNotification} from '@/util/platform-specific/kbfs-notifications'
import {skipAppFocusActions} from '@/local-debug.desktop'
import NotifyPopup from '@/util/notify-popup'
import {noKBFSFailReason} from '@/constants/config'
import {initSharedSubscriptions, _onEngineIncoming} from './shared'
import {wrapErrors} from '@/util/debug'
import * as Constants from '@/constants/fs'
import * as Tabs from '@/constants/tabs'
import * as Path from '@/util/path'
import {uint8ArrayToHex} from 'uint8array-extras'
import {navigateAppend} from '@/constants/router2'
import {errorToActionOrThrow} from '@/stores/fs'
import {ExitCodeFuseKextPermissionError} from '@/constants/values'

const {showMainWindow, activeChanged, requestWindowsStartService, ctlQuit, dumpNodeLogger} = KB2.functions
const {quitApp, exitApp, setOpenAtLogin, copyToClipboard} = KB2.functions
const {openPathInFinder, openURL, getPathType, selectFilesToUploadDialog} = KB2.functions
const {darwinCopyToKBFSTempUploadFile, relaunchApp, uninstallKBFSDialog, uninstallDokanDialog} = KB2.functions
const {windowsCheckMountFromOtherDokanInstall, installCachedDokan, uninstallDokan} = KB2.functions

const dumpLogs = async (reason?: string) => {
  await logger.dump()
  await (dumpNodeLogger?.() ?? Promise.resolve([]))
  // quit as soon as possible
  if (reason === 'quitting through menu') {
    ctlQuit?.()
  }
}

const maybePauseVideos = () => {
  const {appFocused} = useConfigState.getState()
  const videos = document.querySelectorAll('video')
  const allVideos = Array.from(videos)

  allVideos.forEach(v => {
    if (appFocused) {
      if (v.hasAttribute('data-focus-paused')) {
        if (v.paused) {
          v.play()
            .then(() => {})
            .catch(() => {})
        }
      }
    } else {
      // only pause looping videos
      if (!v.paused && v.hasAttribute('loop') && v.hasAttribute('autoplay')) {
        v.setAttribute('data-focus-paused', 'true')
        v.pause()
      }
    }
  })
}

export const onEngineIncoming = (action: EngineGen.Actions) => {
  _onEngineIncoming(action)
  switch (action.type) {
    case EngineGen.keybase1LogsendPrepareLogsend: {
      const f = async () => {
        const response = action.payload.response
        try {
          await dumpLogs()
        } finally {
          response.result()
        }
      }
      ignorePromise(f())
      break
    }
    case EngineGen.keybase1NotifyAppExit:
      console.log('App exit requested')
      exitApp?.(0)
      break
    case EngineGen.keybase1NotifyFSFSActivity:
      kbfsNotification(action.payload.params.notification, NotifyPopup)
      break
    case EngineGen.keybase1NotifyPGPPgpKeyInSecretStoreFile: {
      const f = async () => {
        try {
          await T.RPCGen.pgpPgpStorageDismissRpcPromise()
        } catch (err) {
          console.warn('Error in sending pgpPgpStorageDismissRpc:', err)
        }
      }
      ignorePromise(f())
      break
    }
    case EngineGen.keybase1NotifyServiceShutdown: {
      const {code} = action.payload.params
      if (isWindows && code !== (T.RPCGen.ExitCode.restart as number)) {
        console.log('Quitting due to service shutdown with code: ', code)
        // Quit just the app, not the service
        quitApp?.()
      }
      break
    }

    case EngineGen.keybase1LogUiLog: {
      const {params} = action.payload
      const {level, text} = params
      logger.info('keybase.1.logUi.log:', params.text.data)
      if (level >= T.RPCGen.LogLevel.error) {
        NotifyPopup(text.data)
      }
      break
    }

    case EngineGen.keybase1NotifySessionClientOutOfDate: {
      const {upgradeTo, upgradeURI, upgradeMsg} = action.payload.params
      const body = upgradeMsg || `Please update to ${upgradeTo} by going to ${upgradeURI}`
      NotifyPopup('Client out of date!', {body}, 60 * 60)
      // This is from the API server. Consider notifications from server always critical.
      useConfigState
        .getState()
        .dispatch.setOutOfDate({critical: true, message: upgradeMsg, outOfDate: true, updating: false})
      break
    }
    default:
  }
}

// _openPathInSystemFileManagerPromise opens `openPath` in system file manager.
// If isFolder is true, it just opens it. Otherwise, it shows it in its parent
// folder. This function does not check if the file exists, or try to convert
// KBFS paths. Caller should take care of those.
const _openPathInSystemFileManagerPromise = async (openPath: string, isFolder: boolean): Promise<void> =>
  openPathInFinder?.(openPath, isFolder)

const escapeBackslash = isWindows
  ? (pathElem: string): string =>
      pathElem
        .replace(/‰/g, '‰2030')
        .replace(/([<>:"/\\|?*])/g, (_, c: Uint8Array) => '‰' + uint8ArrayToHex(c))
  : (pathElem: string): string => pathElem

const _rebaseKbfsPathToMountLocation = (kbfsPath: T.FS.Path, mountLocation: string) =>
  Path.join(mountLocation, T.FS.getPathElements(kbfsPath).slice(1).map(escapeBackslash).join(pathSep))

const fuseStatusToUninstallExecPath = isWindows
  ? (status: T.RPCGen.FuseStatus) => {
      const field = status.status.fields?.find(({key}) => key === 'uninstallString')
      return field?.value
    }
  : () => undefined

const fuseStatusToActions =
  (previousStatusType: T.FS.DriverStatusType) => (status: T.RPCGen.FuseStatus | undefined) => {
    if (!status) {
      useFSState.getState().dispatch.setDriverStatus(Constants.defaultDriverStatus)
      return
    }

    if (status.kextStarted) {
      useFSState.getState().dispatch.setDriverStatus({
        ...Constants.emptyDriverStatusEnabled,
        dokanOutdated: status.installAction === T.RPCGen.InstallAction.upgrade,
        dokanUninstallExecPath: fuseStatusToUninstallExecPath(status),
      })
    } else {
      useFSState.getState().dispatch.setDriverStatus(Constants.emptyDriverStatusDisabled)
    }

    if (status.kextStarted && previousStatusType === T.FS.DriverStatusType.Disabled) {
      useFSState
        .getState()
        .dispatch.defer.openPathInSystemFileManagerDesktop?.(T.FS.stringToPath('/keybase'))
    }
  }

const fuseInstallResultIsKextPermissionError = (result: T.RPCGen.InstallResult): boolean =>
  result.componentResults?.findIndex(
    c => c.name === 'fuse' && c.exitCode === ExitCodeFuseKextPermissionError
  ) !== -1

const driverEnableFuse = async (isRetry: boolean) => {
  const result = await T.RPCGen.installInstallFuseRpcPromise()
  if (fuseInstallResultIsKextPermissionError(result)) {
    useFSState.getState().dispatch.driverKextPermissionError()
    if (!isRetry) {
      navigateAppend('kextPermission')
    }
  } else {
    await T.RPCGen.installInstallKBFSRpcPromise() // restarts kbfsfuse
    await T.RPCGen.kbfsMountWaitForMountsRpcPromise()
    useFSState.getState().dispatch.defer.refreshDriverStatusDesktop?.()
  }
}

const uninstallKBFSConfirm = async () => {
  const remove = await (uninstallKBFSDialog?.() ?? Promise.resolve(false))
  if (remove) {
    useFSState.getState().dispatch.driverDisabling()
  }
}

const uninstallKBFS = async () =>
  T.RPCGen.installUninstallKBFSRpcPromise().then(() => {
    // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
    relaunchApp?.()
    exitApp?.(0)
  })

const uninstallDokanConfirm = async () => {
  const driverStatus = useFSState.getState().sfmi.driverStatus
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
    return
  }
  if (!driverStatus.dokanUninstallExecPath) {
    await uninstallDokanDialog?.()
    useFSState.getState().dispatch.defer.refreshDriverStatusDesktop?.()
    return
  }
  useFSState.getState().dispatch.driverDisabling()
}

const onUninstallDokan = async () => {
  const driverStatus = useFSState.getState().sfmi.driverStatus
  if (driverStatus.type !== T.FS.DriverStatusType.Enabled) return
  const execPath: string = driverStatus.dokanUninstallExecPath || ''
  logger.info('Invoking dokan uninstaller', execPath)
  try {
    await uninstallDokan?.(execPath)
  } catch {}
  useFSState.getState().dispatch.defer.refreshDriverStatusDesktop?.()
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
const onInstallCachedDokan = async () => {
  try {
    await installCachedDokan?.()
    useFSState.getState().dispatch.defer.refreshDriverStatusDesktop?.()
  } catch (e) {
    errorToActionOrThrow(e)
  }
}

export const initPlatformListener = () => {
  useConfigState.setState(s => {
    s.dispatch.defer.dumpLogsNative = dumpLogs
    s.dispatch.defer.showMainNative = wrapErrors(() => showMainWindow?.())
    s.dispatch.defer.copyToClipboard = wrapErrors((s: string) => copyToClipboard?.(s))
    s.dispatch.defer.onEngineConnectedDesktop = wrapErrors(() => {
      // Introduce ourselves to the service
      const f = async () => {
        await T.RPCGen.configHelloIAmRpcPromise({details: KB2.constants.helloDetails})
      }
      ignorePromise(f())
    })
  })

  useConfigState.subscribe((s, old) => {
    if (s.appFocused === old.appFocused) return
    useFSState.getState().dispatch.onChangedFocus(s.appFocused)
  })

  useConfigState.subscribe((s, old) => {
    if (s.loggedIn !== old.loggedIn) {
      s.dispatch.osNetworkStatusChanged(navigator.onLine, 'notavailable', true)
    }

    if (s.appFocused !== old.appFocused) {
      maybePauseVideos()
    }

    if (s.openAtLogin !== old.openAtLogin) {
      const {openAtLogin} = s
      const f = async () => {
        if (__DEV__) {
          console.log('onSetOpenAtLogin disabled for dev mode')
          return
        } else {
          await T.RPCGen.configGuiSetValueRpcPromise({
            path: ConfigConstants.openAtLoginKey,
            value: {b: openAtLogin, isNull: false},
          })
        }
        if (isLinux || isWindows) {
          const enabled =
            (await T.RPCGen.ctlGetOnLoginStartupRpcPromise()) === T.RPCGen.OnLoginStartupStatus.enabled
          if (enabled !== openAtLogin) {
            try {
              await T.RPCGen.ctlSetOnLoginStartupRpcPromise({enabled: openAtLogin})
            } catch (error_) {
              const error = error_ as RPCError
              logger.warn(`Error in sending ctlSetOnLoginStartup: ${error.message}`)
            }
          }
        } else {
          logger.info(`Login item settings changed! now ${openAtLogin ? 'on' : 'off'}`)
          await setOpenAtLogin?.(openAtLogin)
        }
      }
      ignorePromise(f())
    }
  })

  const handleWindowFocusEvents = () => {
    const handle = (appFocused: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        useConfigState.getState().dispatch.changedFocus(appFocused)
      }
    }
    window.addEventListener('focus', () => handle(true))
    window.addEventListener('blur', () => handle(false))
  }
  handleWindowFocusEvents()

  const setupReachabilityWatcher = () => {
    window.addEventListener('online', () =>
      useConfigState.getState().dispatch.osNetworkStatusChanged(true, 'notavailable')
    )
    window.addEventListener('offline', () =>
      useConfigState.getState().dispatch.osNetworkStatusChanged(false, 'notavailable')
    )
  }
  setupReachabilityWatcher()

  useDaemonState.subscribe((s, old) => {
    if (s.handshakeVersion !== old.handshakeVersion) {
      if (!isWindows) return

      const f = async () => {
        const waitKey = 'pipeCheckFail'
        const version = s.handshakeVersion
        const {wait} = s.dispatch
        wait(waitKey, version, true)
        try {
          logger.info('Checking RPC ownership')
          if (KB2.functions.winCheckRPCOwnership) {
            await KB2.functions.winCheckRPCOwnership()
          }
          wait(waitKey, version, false)
        } catch (error_) {
          // error will be logged in bootstrap check
          getEngine().reset()
          const error = error_ as RPCError
          wait(waitKey, version, false, error.message || 'windows pipe owner fail', true)
        }
      }
      ignorePromise(f())
    }

    if (s.handshakeState !== old.handshakeState && s.handshakeState === 'done') {
      useConfigState.getState().dispatch.setStartupDetails({
        conversation: Chat.noConversationIDKey,
        followUser: '',
        link: '',
        tab: undefined,
      })
    }
  })

  if (isLinux) {
    useConfigState.getState().dispatch.initUseNativeFrame()
  }
  useConfigState.getState().dispatch.initNotifySound()
  useConfigState.getState().dispatch.initForceSmallNav()
  useConfigState.getState().dispatch.initOpenAtLogin()
  useConfigState.getState().dispatch.initAppUpdateLoop()

  useProfileState.setState(s => {
    s.dispatch.editAvatar = () => {
      useRouterState
        .getState()
        .dispatch.navigateAppend({props: {image: undefined}, selected: 'profileEditAvatar'})
    }
  })

  const initializeInputMonitor = () => {
    const inputMonitor = new InputMonitor()
    inputMonitor.notifyActive = (userActive: boolean) => {
      if (skipAppFocusActions) {
        console.log('Skipping app focus actions!')
      } else {
        useConfigState.getState().dispatch.setActive(userActive)
        // let node thread save file
        activeChanged?.(Date.now(), userActive)
      }
    }
  }
  initializeInputMonitor()

  useDaemonState.setState(s => {
    s.dispatch.onRestartHandshakeNative = () => {
      const {handshakeFailedReason} = useDaemonState.getState()
      if (isWindows && handshakeFailedReason === noKBFSFailReason) {
        requestWindowsStartService?.()
      }
    }
  })

  useFSState.setState(s => {
    s.dispatch.defer.uploadFromDragAndDropDesktop = wrapErrors(
      (parentPath: T.FS.Path, localPaths: string[]) => {
        const {upload} = useFSState.getState().dispatch
        const f = async () => {
          if (isDarwin && darwinCopyToKBFSTempUploadFile) {
            const dir = await T.RPCGen.SimpleFSSimpleFSMakeTempDirForUploadRpcPromise()
            const lp = await Promise.all(
              localPaths.map(async localPath => darwinCopyToKBFSTempUploadFile(dir, localPath))
            )
            lp.forEach(localPath => upload(parentPath, localPath))
          } else {
            localPaths.forEach(localPath => upload(parentPath, localPath))
          }
        }
        ignorePromise(f())
      }
    )

    s.dispatch.defer.openLocalPathInSystemFileManagerDesktop = wrapErrors((localPath: string) => {
      const f = async () => {
        try {
          if (getPathType) {
            const pathType = await getPathType(localPath)
            await _openPathInSystemFileManagerPromise(localPath, pathType === 'directory')
          }
        } catch (e) {
          errorToActionOrThrow(e)
        }
      }
      ignorePromise(f())
    })

    s.dispatch.defer.openPathInSystemFileManagerDesktop = wrapErrors((path: T.FS.Path) => {
      const f = async () => {
        const {sfmi, pathItems} = useFSState.getState()
        return sfmi.driverStatus.type === T.FS.DriverStatusType.Enabled && sfmi.directMountDir
          ? _openPathInSystemFileManagerPromise(
              _rebaseKbfsPathToMountLocation(path, sfmi.directMountDir),
              ![T.FS.PathKind.InGroupTlf, T.FS.PathKind.InTeamTlf].includes(Constants.parsePath(path).kind) ||
                Constants.getPathItem(pathItems, path).type === T.FS.PathType.Folder
            ).catch((e: unknown) => errorToActionOrThrow(e, path))
          : new Promise<void>((resolve, reject) => {
              if (sfmi.driverStatus.type !== T.FS.DriverStatusType.Enabled) {
                // This usually indicates a developer error as
                // openPathInSystemFileManager shouldn't be used when FUSE integration
                // is not enabled. So just blackbar to encourage a log send.
                reject(new Error('FUSE integration is not enabled'))
              } else {
                logger.warn('empty directMountDir') // if this happens it might be a race?
                resolve()
              }
            })
      }
      ignorePromise(f())
    })

    s.dispatch.defer.refreshDriverStatusDesktop = wrapErrors(() => {
      const f = async () => {
        let status = await T.RPCGen.installFuseStatusRpcPromise({
          bundleVersion: '',
        })
        if (isWindows && status.installStatus !== T.RPCGen.InstallStatus.installed) {
          const m = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
          status = await (windowsCheckMountFromOtherDokanInstall?.(m, status) ?? Promise.resolve(status))
        }
        fuseStatusToActions(useFSState.getState().sfmi.driverStatus.type)(status)
      }
      ignorePromise(f())
    })

    s.dispatch.defer.refreshMountDirsDesktop = wrapErrors(() => {
      const f = async () => {
        const {sfmi, dispatch} = useFSState.getState()
        const driverStatus = sfmi.driverStatus
        if (driverStatus.type !== T.FS.DriverStatusType.Enabled) {
          return
        }
        const directMountDir = await T.RPCGen.kbfsMountGetCurrentMountDirRpcPromise()
        const preferredMountDirs = await T.RPCGen.kbfsMountGetPreferredMountDirsRpcPromise()
        dispatch.setDirectMountDir(directMountDir)
        dispatch.setPreferredMountDirs(preferredMountDirs || [])
      }
      ignorePromise(f())
    })

    s.dispatch.defer.setSfmiBannerDismissedDesktop = wrapErrors((dismissed: boolean) => {
      const f = async () => {
        await T.RPCGen.SimpleFSSimpleFSSetSfmiBannerDismissedRpcPromise({dismissed})
      }
      ignorePromise(f())
    })

    s.dispatch.defer.afterDriverEnabled = wrapErrors((isRetry: boolean) => {
      const f = async () => {
        useFSState.getState().dispatch.defer.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await onInstallCachedDokan()
        } else {
          await driverEnableFuse(isRetry)
        }
      }
      ignorePromise(f())
    })

    s.dispatch.defer.afterDriverDisable = wrapErrors(() => {
      const f = async () => {
        useFSState.getState().dispatch.defer.setSfmiBannerDismissedDesktop?.(false)
        if (isWindows) {
          await uninstallDokanConfirm()
        } else {
          await uninstallKBFSConfirm()
        }
      }
      ignorePromise(f())
    })

    s.dispatch.defer.afterDriverDisabling = wrapErrors(() => {
      const f = async () => {
        if (isWindows) {
          await onUninstallDokan()
        } else {
          await uninstallKBFS()
        }
      }
      ignorePromise(f())
    })

    s.dispatch.defer.openSecurityPreferencesDesktop = wrapErrors(() => {
      const f = async () => {
        await openURL?.('x-apple.systempreferences:com.apple.preference.security?General', {activate: true})
      }
      ignorePromise(f())
    })

    s.dispatch.defer.openFilesFromWidgetDesktop = wrapErrors((path: T.FS.Path) => {
      useConfigState.getState().dispatch.showMain()
      if (path) {
        Constants.navToPath(path)
      } else {
        navigateAppend(Tabs.fsTab)
      }
    })

    s.dispatch.defer.openAndUploadDesktop = wrapErrors(
      (type: T.FS.OpenDialogType, parentPath: T.FS.Path) => {
        const f = async () => {
          const localPaths = await (selectFilesToUploadDialog?.(type, parentPath ?? undefined) ??
            Promise.resolve([]))
          localPaths.forEach(localPath => useFSState.getState().dispatch.upload(parentPath, localPath))
        }
        ignorePromise(f())
      }
    )

    if (!isLinux) {
      s.dispatch.defer.afterKbfsDaemonRpcStatusChanged = wrapErrors(() => {
        const {kbfsDaemonStatus, dispatch} = useFSState.getState()
        if (kbfsDaemonStatus.rpcStatus === T.FS.KbfsDaemonRpcStatus.Connected) {
          dispatch.defer.refreshDriverStatusDesktop?.()
        }
        dispatch.defer.refreshMountDirsDesktop?.()
      })
      // force call as it could have happened already
      s.dispatch.defer.afterKbfsDaemonRpcStatusChanged()
    }
  })

  initSharedSubscriptions()
}

export {onEngineConnected, onEngineDisconnected} from './shared'
