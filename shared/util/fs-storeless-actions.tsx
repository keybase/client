import type * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {errorToActionOrThrow, useFSState} from '@/stores/fs'
import {
  openLocalPathInSystemFileManagerDesktop as openLocalPathInSystemFileManagerInPlatform,
  openPathInSystemFileManagerDesktop as openPathInSystemFileManagerInPlatform,
} from '@/stores/fs-platform'

export const openLocalPathInSystemFileManagerDesktop = (localPath: string) => {
  const f = async () => {
    try {
      await openLocalPathInSystemFileManagerInPlatform(localPath)
    } catch (e) {
      errorToActionOrThrow(e)
    }
  }
  ignorePromise(f())
}

export const openPathInSystemFileManagerDesktop = (path: T.FS.Path) => {
  const f = async () => {
    const {sfmi, pathItems} = useFSState.getState()
    try {
      await openPathInSystemFileManagerInPlatform(path, pathItems, sfmi.driverStatus, sfmi.directMountDir)
    } catch (e) {
      errorToActionOrThrow(e, path)
    }
  }
  ignorePromise(f())
}
