// @flow
import * as FsGen from '../fs-gen'
import * as Saga from '../../util/saga'
import * as Config from '../../constants/config'
import * as RPCTypes from '../../constants/types/rpc-gen'
import * as Types from '../../constants/types/fs'
import * as Constants from '../../constants/fs'
import * as SafeElectron from '../../util/safe-electron.desktop'
import fs from 'fs'
import type {TypedState} from '../../constants/reducer'
import {fileUIName, isLinux, isWindows} from '../../constants/platform'
import {fsTab} from '../../constants/tabs'
import logger from '../../logger'
import {spawn, execFileSync} from 'child_process'
import path from 'path'
import {putActionIfOnPath, navigateTo, navigateAppend, navigateUp} from '../route-tree'
import {saveAttachmentDialog, showShareActionSheet} from '../platform-specific'

type pathType = 'file' | 'directory'

// pathToURL takes path and converts to (file://) url.
// See https://github.com/sindresorhus/file-url
function pathToURL(path: string): string {
  let goodPath = path.replace(/\\/g, '/')

  // Windows drive letter must be prefixed with a slash
  if (goodPath[0] !== '/') {
    goodPath = '/' + goodPath
  }

  return encodeURI('file://' + goodPath).replace(/#/g, '%23')
}

function openInDefaultDirectory(openPath: string) {
  return new Promise((resolve, reject) => {
    // Paths in directories might be symlinks, so resolve using
    // realpath.
    // For example /keybase/private/gabrielh,chris gets redirected to
    // /keybase/private/chris,gabrielh.
    fs.realpath(openPath, (err, resolvedPath) => {
      if (err) {
        reject(new Error(`No realpath for ${openPath}: ${err}`))
        return
      }
      // Convert to URL for openExternal call.
      // We use openExternal instead of openItem because it
      // correctly focuses' the Finder, and also uses a newer
      // native API on macOS.
      const url = pathToURL(resolvedPath)
      logger.info('Open URL (directory):', url)

      SafeElectron.getShell().openExternal(url, {activate: true}, err => {
        if (err) {
          reject(err)
          return
        }
        logger.info('Opened directory:', openPath)
        resolve()
      })
    })
  })
}

function getPathType(openPath: string): Promise<pathType> {
  return new Promise((resolve, reject) => {
    fs.stat(openPath, (err, stats) => {
      if (err) {
        reject(new Error(`Unable to open/stat file: ${openPath}`))
        return
      }
      if (stats.isFile()) {
        resolve('file')
      } else if (stats.isDirectory()) {
        resolve('directory')
      } else {
        reject(new Error(`Unable to open: Not a file or directory`))
      }
    })
  })
}

function _open(openPath: string) {
  return new Promise((resolve, reject) => {
    getPathType(openPath).then(typ => {
      if (typ === 'directory') {
        if (isWindows) {
          if (!SafeElectron.getShell().openItem(openPath)) {
            reject(new Error(`Unable to open item: ${openPath}`))
            return
          }
        } else {
          openInDefaultDirectory(openPath).then(resolve, reject)
          return
        }
      } else if (typ === 'file') {
        if (!SafeElectron.getShell().showItemInFolder(openPath)) {
          reject(new Error(`Unable to open item in folder: ${openPath}`))
          return
        }
      } else {
        reject(new Error(`Invalid path type`))
        return
      }
      resolve()
    })
  })
}

function openInFileUISaga({payload: {path}}: FsGen.OpenInFileUIPayload, state: TypedState) {
  const openPath = path || Config.defaultKBFSPath
  const enabled = state.fs.fuseStatus && state.fs.fuseStatus.kextStarted
  if (isLinux || enabled) {
    return Saga.call(_open, openPath)
  } else {
    return Saga.put(navigateTo([fsTab, {props: {path: Types.stringToPath(openPath)}, selected: 'folder'}]))
  }
}

function waitForMount(attempt: number) {
  return new Promise((resolve, reject) => {
    // Read the KBFS path waiting for files to exist, which means it's mounted
    // TODO: should handle current mount directory
    fs.readdir(Config.defaultKBFSPath, (err, files) => {
      if (!err && files.length > 0) {
        resolve(true)
      } else if (attempt > 15) {
        reject(new Error(`${Config.defaultKBFSPath} is unavailable. Please try again.`))
      } else {
        setTimeout(() => {
          waitForMount(attempt + 1).then(resolve, reject)
        }, 1000)
      }
    })
  })
}

const installKBFS = () => Saga.call(RPCTypes.installInstallKBFSRpcPromise)
const installKBFSSuccess = (result: RPCTypes.InstallResult) =>
  Saga.sequentially([
    Saga.call(waitForMount, 0),
    Saga.put(FsGen.createSetFlags({kbfsInstalling: false, showBanner: true})),
  ])

function fuseStatusResultSaga({payload: {prevStatus, status}}: FsGen.FuseStatusResultPayload) {
  // If our kextStarted status changed, finish KBFS install
  if (status.kextStarted && prevStatus && !prevStatus.kextStarted) {
    return Saga.call(installKBFS)
  }
}

function* fuseStatusSaga(): Saga.SagaGenerator<any, any> {
  const state: TypedState = yield Saga.select()
  const prevStatus = state.favorite.fuseStatus

  let status = yield Saga.call(RPCTypes.installFuseStatusRpcPromise, {bundleVersion: ''})
  if (isWindows && status.installStatus !== RPCTypes.installInstallStatus.installed) {
    // Check if another Dokan we didn't install mounted the filesystem
    const kbfsMount = yield Saga.call(RPCTypes.kbfsMountGetCurrentMountDirRpcPromise)
    if (kbfsMount && fs.existsSync(kbfsMount)) {
      status.installStatus = RPCTypes.installInstallStatus.installed
      status.installAction = RPCTypes.installInstallAction.none
      status.kextStarted = true
    }
  }
  yield Saga.put(FsGen.createFuseStatusResult({prevStatus, status}))
}

function* installFuseSaga(): Saga.SagaGenerator<any, any> {
  const result: RPCTypes.InstallResult = yield Saga.call(RPCTypes.installInstallFuseRpcPromise)
  const fuseResults =
    result && result.componentResults ? result.componentResults.filter(c => c.name === 'fuse') : []
  const kextPermissionError =
    fuseResults.length > 0 && fuseResults[0].exitCode === Constants.ExitCodeFuseKextPermissionError

  if (kextPermissionError) {
    // Add a small delay here, since on 10.13 the OS will be a little laggy
    // when showing a kext permission error.
    yield Saga.delay(1e3)
  }

  yield Saga.put(FsGen.createInstallFuseResult({kextPermissionError}))
  yield Saga.put(FsGen.createFuseStatus())
  yield Saga.put(FsGen.createSetFlags({fuseInstalling: false}))
  // TODO: do something like uninstallConfirmSaga here
}

const uninstallKBFSConfirmSaga = (action: FsGen.UninstallKBFSConfirmPayload) =>
  SafeElectron.getDialog().showMessageBox(
    null,
    {
      buttons: ['Remove & Restart', 'Cancel'],
      detail: `Are you sure you want to remove Keybase from ${fileUIName} and restart the app?`,
      message: `Remove Keybase from ${fileUIName}`,
      type: 'question',
    },
    resp => (resp ? undefined : Saga.sequentially([
      Saga.call(RPCTypes.installUninstallKBFSRpcPromise),
      Saga.call(() => {
          // Restart since we had to uninstall KBFS and it's needed by the service (for chat)
          SafeElectron.getApp().relaunch()
          SafeElectron.getApp().exit(0)
        }
      )
    ]))
  )

function openSecurityPreferences() {
  return Saga.call(
    () =>
      new Promise((resolve, reject) => {
        SafeElectron.getShell().openExternal(
          'x-apple.systempreferences:com.apple.preference.security?General',
          {activate: true},
          err => {
            if (err) {
              reject(err)
              return
            }
            logger.info('Opened Security Preferences')
            resolve()
          }
        )
      })
  )
}

// Invoking the cached installer package has to happen from the topmost process
// or it won't be visible to the user. The service also does this to support command line
// operations.
function installCachedDokan() {
  return new Promise((resolve, reject) => {
    logger.info('Invoking dokan installer')
    const dokanPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'DokanSetup_redist.exe')
    try {
      execFileSync(dokanPath, [])
    } catch (err) {
      logger.error('installCachedDokan caught', err)
      reject(err)
      return
    }
    // restart the service, particularly kbfsdokan
    // based on desktop/app/start-win-service.js
    const binPath = path.resolve(String(process.env.LOCALAPPDATA), 'Keybase', 'keybase.exe')
    if (!binPath) {
      return
    }
    const rqPath = binPath.replace('keybase.exe', 'keybaserq.exe')
    const args = [binPath, 'ctl', 'restart']

    spawn(rqPath, args, {
      detached: true,
      stdio: 'ignore',
    })

    resolve()
  })
}

function installDokanSaga() {
  return Saga.call(installCachedDokan)
}

function openFinderPopup(action: FsGen.OpenFinderPopupPayload) {
  const {targetRect, routePath} = action.payload
  return Saga.put(
    putActionIfOnPath(
      routePath,
      navigateAppend([
        {
          props: {
            targetRect,
            position: 'bottom right',
            onHidden: () => Saga.put(navigateUp()),
            onInstall: () => Saga.put(FsGen.createInstallFuse()),
          },
          selected: 'finderAction',
        },
      ])
    )
  )
}

function platformSpecificIntentEffect(
  intent: Types.TransferIntent,
  localPath: string,
  mimeType: string
): ?Saga.Effect {
  switch (intent) {
    case 'camera-roll':
      return Saga.call(saveAttachmentDialog, localPath)
    case 'share':
      return Saga.call(showShareActionSheet, {url: localPath, mimeType})
    case 'none':
    case 'web-view':
    case 'web-view-text':
      return null
    default:
      /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(intent);
      */
      return null
  }
}

function* platformSpecificSaga(): Saga.SagaGenerator<any, any> {
  yield Saga.safeTakeEveryPure(FsGen.openInFileUI, openInFileUISaga)
  yield Saga.safeTakeEvery(FsGen.fuseStatus, fuseStatusSaga)
  yield Saga.safeTakeEveryPure(FsGen.fuseStatusResult, fuseStatusResultSaga)
  yield Saga.safeTakeEveryPure(FsGen.installKBFS, installKBFS, installKBFSSuccess)
  yield Saga.safeTakeEveryPure(FsGen.uninstallKBFSConfirm, uninstallKBFSConfirmSaga)
  yield Saga.safeTakeEveryPure(FsGen.uninstallKBFS, uninstallKBFS, uninstallKBFSSuccess)
  if (isWindows) {
    yield Saga.safeTakeEveryPure(FsGen.installFuse, installDokanSaga)
  } else {
    yield Saga.safeTakeEvery(FsGen.installFuse, installFuseSaga)
  }
  yield Saga.safeTakeEveryPure(FsGen.openSecurityPreferences, openSecurityPreferences)

  // These are saga tasks that may use actions above.
  yield Saga.safeTakeEveryPure(FsGen.openFinderPopup, openFinderPopup)
}

export {platformSpecificIntentEffect, platformSpecificSaga}
