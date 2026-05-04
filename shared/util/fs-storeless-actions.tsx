import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {errorToActionOrThrowWithHandlers} from '@/fs/common/error-state'
import {useConfigState} from '@/stores/config'
import {
  fuseStatusToDriverStatus,
  openLocalPathInSystemFileManagerDesktop as openLocalPathInSystemFileManagerInPlatform,
  openPathInSystemFileManagerDesktop as openPathInSystemFileManagerInPlatform,
  refreshDriverStatusDesktop as refreshDriverStatusInPlatform,
  refreshMountDirsDesktop as refreshMountDirsInPlatform,
} from '@/stores/fs-platform'

const noopSoftError = () => {}

const errorToGlobalActionOrThrow = (error: unknown, path?: T.FS.Path) =>
  errorToActionOrThrowWithHandlers(
    {
      checkKbfsDaemonRpcStatus: () => {},
      redbar: error => useConfigState.getState().dispatch.setGlobalError(new Error(error)),
      setPathSoftError: noopSoftError,
      setTlfSoftError: noopSoftError,
    },
    error,
    path
  )

export const openLocalPathInSystemFileManagerDesktop = (
  localPath: string,
  onErrorOrThrow: (error: unknown) => void = errorToGlobalActionOrThrow
) => {
  const f = async () => {
    try {
      await openLocalPathInSystemFileManagerInPlatform(localPath)
    } catch (e) {
      onErrorOrThrow(e)
    }
  }
  ignorePromise(f())
}

export const openPathInSystemFileManagerDesktop = (
  path: T.FS.Path,
  onErrorOrThrow: (error: unknown, path?: T.FS.Path) => void = errorToGlobalActionOrThrow
) => {
  const f = async () => {
    try {
      const status = await refreshDriverStatusInPlatform()
      const driverStatus = fuseStatusToDriverStatus(status)
      const {directMountDir} =
        driverStatus.type === T.FS.DriverStatusType.Enabled
          ? await refreshMountDirsInPlatform()
          : {directMountDir: ''}
      await openPathInSystemFileManagerInPlatform(path, driverStatus, directMountDir)
    } catch (e) {
      onErrorOrThrow(e, path)
    }
  }
  ignorePromise(f())
}
