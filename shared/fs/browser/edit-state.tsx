import * as Constants from '@/constants/fs'
import * as S from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import * as React from 'react'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {useFsErrorActionOrThrow} from '../common/error-state'
import {useFsLoadedPathItems} from '../common/hooks'
import {makeEditID, makeUUID} from '@/stores/fs'

export type BrowserEditSession = Readonly<{
  commitEdit: () => void
  discardEdit: () => void
  edit: T.FS.Edit
  editID: T.FS.EditID
  isSubmitting: boolean
  setEditName: (name: string) => void
}>

type BrowserEditContextType = {
  edits: ReadonlyMap<T.FS.EditID, BrowserEditSession>
  newFolderRow: (parentPath: T.FS.Path) => void
  startRename: (path: T.FS.Path) => void
}

const BrowserEditContext = React.createContext<BrowserEditContextType | null>(null)

type BrowserEditState = {
  edits: ReadonlyMap<T.FS.EditID, T.FS.Edit>
  submitting: ReadonlySet<T.FS.EditID>
}

const makeEmptyBrowserEditState = (): BrowserEditState => ({
  edits: new Map(),
  submitting: new Set(),
})

let browserEditState = makeEmptyBrowserEditState()
let browserEditProviderCount = 0
const browserEditStateListeners = new Set<() => void>()

const subscribeBrowserEditState = (listener: () => void) => {
  browserEditStateListeners.add(listener)
  return () => {
    browserEditStateListeners.delete(listener)
  }
}

const getBrowserEditStateSnapshot = () => browserEditState

const setBrowserEditState = (updater: (prevState: BrowserEditState) => BrowserEditState) => {
  const nextState = updater(browserEditState)
  if (nextState === browserEditState) {
    return
  }
  browserEditState = nextState
  browserEditStateListeners.forEach(listener => listener())
}

const setBrowserEdits = (
  updater: (prevEdits: ReadonlyMap<T.FS.EditID, T.FS.Edit>) => ReadonlyMap<T.FS.EditID, T.FS.Edit>
) => {
  setBrowserEditState(prevState => {
    const edits = updater(prevState.edits)
    return edits === prevState.edits ? prevState : {...prevState, edits}
  })
}

const setBrowserSubmitting = (
  updater: (prevSubmitting: ReadonlySet<T.FS.EditID>) => ReadonlySet<T.FS.EditID>
) => {
  setBrowserEditState(prevState => {
    const submitting = updater(prevState.submitting)
    return submitting === prevState.submitting ? prevState : {...prevState, submitting}
  })
}

const resetBrowserEditState = () => {
  browserEditState = makeEmptyBrowserEditState()
  browserEditStateListeners.forEach(listener => listener())
}

const addOrReplaceEdit = (
  prevEdits: ReadonlyMap<T.FS.EditID, T.FS.Edit>,
  editID: T.FS.EditID,
  edit: T.FS.Edit
) => {
  const nextEdits = new Map(prevEdits)
  nextEdits.set(editID, edit)
  return nextEdits
}

const deleteEdit = (prevEdits: ReadonlyMap<T.FS.EditID, T.FS.Edit>, editID: T.FS.EditID) => {
  if (!prevEdits.has(editID)) {
    return prevEdits
  }
  const nextEdits = new Map(prevEdits)
  nextEdits.delete(editID)
  return nextEdits
}

const addSubmitting = (prevSubmitting: ReadonlySet<T.FS.EditID>, editID: T.FS.EditID) => {
  if (prevSubmitting.has(editID)) {
    return prevSubmitting
  }
  const nextSubmitting = new Set(prevSubmitting)
  nextSubmitting.add(editID)
  return nextSubmitting
}

const deleteSubmitting = (prevSubmitting: ReadonlySet<T.FS.EditID>, editID: T.FS.EditID) => {
  if (!prevSubmitting.has(editID)) {
    return prevSubmitting
  }
  const nextSubmitting = new Set(prevSubmitting)
  nextSubmitting.delete(editID)
  return nextSubmitting
}

export const useFsBrowserEdits = () => React.useContext(BrowserEditContext)

const getStaleRenameEditIDs = (
  edits: ReadonlyMap<T.FS.EditID, T.FS.Edit>,
  pathItems: T.FS.PathItems
): ReadonlySet<T.FS.EditID> => {
  const stale = new Set<T.FS.EditID>()
  edits.forEach((edit, editID) => {
    if (edit.type !== T.FS.EditType.Rename) {
      return
    }
    const parent = Constants.getPathItem(pathItems, edit.parentPath)
    if (!(parent.type === T.FS.PathType.Folder && parent.children.has(edit.originalName))) {
      stale.add(editID)
    }
  })
  return stale
}

export const FsBrowserEditProvider = ({children}: {children: React.ReactNode}) => {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const {edits, submitting} = React.useSyncExternalStore(
    subscribeBrowserEditState,
    getBrowserEditStateSnapshot,
    getBrowserEditStateSnapshot
  )
  const pathItems = useFsLoadedPathItems()

  React.useEffect(() => {
    browserEditProviderCount++
    return () => {
      browserEditProviderCount--
      if (!browserEditProviderCount) {
        resetBrowserEditState()
      }
    }
  }, [])

  React.useEffect(() => {
    const staleEditIDs = getStaleRenameEditIDs(edits, pathItems)
    if (!staleEditIDs.size) {
      return
    }
    setBrowserEditState(prevState => {
      const nextEdits = new Map(prevState.edits)
      const nextSubmitting = new Set(prevState.submitting)
      staleEditIDs.forEach(editID => {
        nextEdits.delete(editID)
        nextSubmitting.delete(editID)
      })
      return {
        edits: nextEdits,
        submitting: nextSubmitting,
      }
    })
  }, [edits, pathItems])

  const commitEdit = (editID: T.FS.EditID) => {
    const edit = edits.get(editID)
    if (!edit) {
      return
    }
    setBrowserSubmitting(prevSubmitting => addSubmitting(prevSubmitting, editID))
    const f = async () => {
      try {
        switch (edit.type) {
          case T.FS.EditType.NewFolder:
            await T.RPCGen.SimpleFSSimpleFSOpenRpcPromise(
              {
                dest: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                flags: T.RPCGen.OpenFlags.directory,
                opID: makeUUID(),
              },
              S.waitingKeyFSCommitEdit
            )
            break
          case T.FS.EditType.Rename: {
            const opID = makeUUID()
            await T.RPCGen.SimpleFSSimpleFSMoveRpcPromise({
              dest: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
              opID,
              overwriteExistingFiles: false,
              src: Constants.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.originalName)),
            })
            await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, S.waitingKeyFSCommitEdit)
            break
          }
        }
        setBrowserEdits(prevEdits => deleteEdit(prevEdits, editID))
      } catch (error) {
        if (
          edit.type === T.FS.EditType.Rename &&
          error instanceof RPCError &&
          [T.RPCGen.StatusCode.scsimplefsdirnotempty, T.RPCGen.StatusCode.scsimplefsnameexists].includes(
            error.code
          )
        ) {
          setBrowserEdits(prevEdits =>
            addOrReplaceEdit(prevEdits, editID, {...edit, error: error.desc || 'name exists'})
          )
          return
        }
        errorToActionOrThrow(error, edit.parentPath)
      } finally {
        setBrowserSubmitting(prevSubmitting => deleteSubmitting(prevSubmitting, editID))
      }
    }
    ignorePromise(f())
  }

  const discardEdit = (editID: T.FS.EditID) => {
    setBrowserEdits(prevEdits => deleteEdit(prevEdits, editID))
    setBrowserSubmitting(prevSubmitting => deleteSubmitting(prevSubmitting, editID))
  }

  const setEditName = (editID: T.FS.EditID, name: string) => {
    setBrowserEdits(prevEdits => {
      const edit = prevEdits.get(editID)
      if (!edit || edit.name === name) {
        return prevEdits
      }
      return addOrReplaceEdit(prevEdits, editID, {...edit, error: undefined, name})
    })
  }

  const startRename = (path: T.FS.Path) => {
    const parentPath = T.FS.getPathParent(path)
    const originalName = T.FS.getPathName(path)
    setBrowserEdits(prevEdits =>
      addOrReplaceEdit(prevEdits, makeEditID(), {
        name: originalName,
        originalName,
        parentPath,
        type: T.FS.EditType.Rename,
      })
    )
  }

  const newFolderRow = (parentPath: T.FS.Path) => {
    const parentPathItem = Constants.getPathItem(pathItems, parentPath)
    if (parentPathItem.type !== T.FS.PathType.Folder) {
      console.warn(`bad parentPath: ${parentPathItem.type}`)
      return
    }

    const existingNewFolderNames = new Set([...edits.values()].map(({name}) => name))

    let newFolderName = 'New Folder'
    let i = 2
    while (parentPathItem.children.has(newFolderName) || existingNewFolderNames.has(newFolderName)) {
      newFolderName = `New Folder ${i}`
      ++i
    }

    setBrowserEdits(prevEdits =>
      addOrReplaceEdit(prevEdits, makeEditID(), {
        ...Constants.emptyNewFolder,
        name: newFolderName,
        originalName: newFolderName,
        parentPath,
      })
    )
  }

  const sessions = new Map<T.FS.EditID, BrowserEditSession>()
  edits.forEach((edit, editID) => {
    sessions.set(editID, {
      commitEdit: () => commitEdit(editID),
      discardEdit: () => discardEdit(editID),
      edit,
      editID,
      isSubmitting: submitting.has(editID),
      setEditName: (name: string) => setEditName(editID, name),
    })
  })

  return (
    <BrowserEditContext.Provider value={{edits: sessions, newFolderRow, startRename}}>
      {children}
    </BrowserEditContext.Provider>
  )
}
