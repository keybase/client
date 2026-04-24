import * as C from '@/constants'
import * as React from 'react'
import * as T from '@/constants/types'
import * as FS from '@/stores/fs'

export const useNonFolderSyncingPaths = (syncingPaths: ReadonlySet<T.FS.Path>) => {
  const [pathTypes, setPathTypes] = React.useState<Map<T.FS.Path, T.FS.PathType>>(() => new Map())
  const syncingPathList = [...syncingPaths]
  const syncingPathKey = syncingPathList.join('|')
  const pathTypesVersionRef = React.useRef(0)

  React.useEffect(() => {
    const paths = [...syncingPaths]
    const version = ++pathTypesVersionRef.current
    setPathTypes(prevPathTypes => {
      const nextPathTypes = new Map(prevPathTypes)
      let changed = false
      nextPathTypes.forEach((_, path) => {
        if (!syncingPaths.has(path)) {
          nextPathTypes.delete(path)
          changed = true
        }
      })
      return changed ? nextPathTypes : prevPathTypes
    })

    const unloadedPaths = paths.filter(path => !pathTypes.has(path))
    if (!unloadedPaths.length) {
      return
    }

    const f = async () => {
      const resolvedTypes = await Promise.all(
        unloadedPaths.map(async path => {
          try {
            const dirent = await T.RPCGen.SimpleFSSimpleFSStatRpcPromise({
              path: FS.pathToRPCPath(path),
              refreshSubscription: false,
            })
            return {
              path,
              type:
                dirent.direntType === T.RPCGen.DirentType.dir ? T.FS.PathType.Folder : T.FS.PathType.File,
            }
          } catch {
            return {path, type: T.FS.PathType.Unknown}
          }
        })
      )
      if (pathTypesVersionRef.current !== version) {
        return
      }
      setPathTypes(prevPathTypes => {
        const nextPathTypes = new Map(prevPathTypes)
        resolvedTypes.forEach(({path, type}) => {
          nextPathTypes.set(path, type)
        })
        return nextPathTypes
      })
    }
    C.ignorePromise(f())
  }, [pathTypes, syncingPathKey, syncingPaths])

  return syncingPathList.filter(path => pathTypes.get(path) !== T.FS.PathType.Folder)
}
