import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as FS from '@/stores/fs'
import {useFsLoadedPathItems} from './hooks'

const statBatchSize = 10
const statBatchDelayMs = 250

const statPathType = async (path: T.FS.Path): Promise<T.FS.PathType> => {
  try {
    const dirent = await T.RPCGen.SimpleFSSimpleFSStatRpcPromise({
      path: FS.pathToRPCPath(path),
      refreshSubscription: false,
    })
    return dirent.direntType === T.RPCGen.DirentType.dir ? T.FS.PathType.Folder : T.FS.PathType.File
  } catch {
    return T.FS.PathType.Unknown
  }
}

export const useNonFolderSyncingPaths = (syncingPaths: ReadonlySet<T.FS.Path>) => {
  const loadedPathItems = useFsLoadedPathItems()
  const [pathTypes, _setPathTypes] = React.useState<ReadonlyMap<T.FS.Path, T.FS.PathType>>(() => new Map())
  const inFlightPaths = React.useRef(new Set<T.FS.Path>())
  const latestSyncingPaths = React.useRef(syncingPaths)
  const pathTypesRef = React.useRef(pathTypes)
  const syncingPathCount = syncingPaths.size

  const setPathTypes = React.useEffectEvent(
    (
      updater: (
        prevPathTypes: ReadonlyMap<T.FS.Path, T.FS.PathType>
      ) => ReadonlyMap<T.FS.Path, T.FS.PathType>
    ) => {
      _setPathTypes(prevPathTypes => {
        const nextPathTypes = updater(prevPathTypes)
        pathTypesRef.current = nextPathTypes
        return nextPathTypes
      })
    }
  )

  React.useEffect(() => {
    pathTypesRef.current = pathTypes
  }, [pathTypes])

  React.useEffect(() => {
    const syncingPathList = [...syncingPaths]
    latestSyncingPaths.current = syncingPaths
    setPathTypes(prevPathTypes => {
      const nextPathTypes = new Map(prevPathTypes)
      let changed = false
      for (const path of prevPathTypes.keys()) {
        if (!syncingPaths.has(path)) {
          nextPathTypes.delete(path)
          changed = true
        }
      }
      for (const path of syncingPathList) {
        const loadedType = loadedPathItems.get(path)?.type
        if (loadedType && loadedType !== T.FS.PathType.Unknown && loadedType !== prevPathTypes.get(path)) {
          nextPathTypes.set(path, loadedType)
          changed = true
        }
      }
      return changed ? nextPathTypes : prevPathTypes
    })

    const unresolvedPaths = syncingPathList.filter(path => {
      const loadedType = loadedPathItems.get(path)?.type
      return (
        (!loadedType || loadedType === T.FS.PathType.Unknown) &&
        !pathTypesRef.current.has(path) &&
        !inFlightPaths.current.has(path)
      )
    })
    if (!unresolvedPaths.length) {
      return
    }
    const f = async () => {
      for (let idx = 0; idx < unresolvedPaths.length; idx += statBatchSize) {
        const batch = unresolvedPaths
          .slice(idx, idx + statBatchSize)
          .filter(path => latestSyncingPaths.current.has(path) && !pathTypesRef.current.has(path))
        if (!batch.length) {
          continue
        }
        batch.forEach(path => inFlightPaths.current.add(path))
        const resolvedTypes = await Promise.all(
          batch.map(async path => ({
            path,
            type: await statPathType(path),
          }))
        )
        batch.forEach(path => inFlightPaths.current.delete(path))
        setPathTypes(prevPathTypes => {
          let nextPathTypes: Map<T.FS.Path, T.FS.PathType> | undefined
          for (const {path, type} of resolvedTypes) {
            if (!latestSyncingPaths.current.has(path) || prevPathTypes.get(path) === type) {
              continue
            }
            nextPathTypes ??= new Map(prevPathTypes)
            nextPathTypes.set(path, type)
          }
          return nextPathTypes ?? prevPathTypes
        })
        if (idx + statBatchSize < unresolvedPaths.length) {
          await C.timeoutPromise(statBatchDelayMs)
        }
      }
    }
    C.ignorePromise(f())
  }, [loadedPathItems, syncingPathCount, syncingPaths])

  return [...syncingPaths].filter(path => pathTypes.get(path) !== T.FS.PathType.Folder)
}
