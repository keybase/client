import type * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {errorToActionOrThrow, useFSState} from '@/stores/fs'
import {
  openLocalPathInSystemFileManagerDesktop as openLocalPathInSystemFileManagerInPlatform,
  openPathInSystemFileManagerDesktop as openPathInSystemFileManagerInPlatform,
} from '@/stores/fs-platform'

export const openLocalPathInSystemFileManagerDesktop = (
  localPath: string,
  onErrorOrThrow: (error: unknown) => void = errorToActionOrThrow
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
  onErrorOrThrow: (error: unknown, path?: T.FS.Path) => void = errorToActionOrThrow
) => {
  const f = async () => {
    const {sfmi} = useFSState.getState()
    try {
      await openPathInSystemFileManagerInPlatform(path, sfmi.driverStatus, sfmi.directMountDir)
    } catch (e) {
      onErrorOrThrow(e, path)
    }
  }
  ignorePromise(f())
}
