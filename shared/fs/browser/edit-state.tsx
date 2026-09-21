import * as Constants from '@/constants/fs'
import * as S from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import * as React from 'react'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {makeEditID, makeUUID} from '../common/client'
import {useFsErrorActionOrThrow} from '../common/error-state'
import {useFsLoadedPathItems} from '../common/hooks'

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

// A pending edit is ephemeral screen state: it belongs to the folder the screen
// is showing, and losing that screen is allowed to drop it. Several providers
// can be mounted for one screen (the browser and, on iOS, the header menu), so
// claims are counted, and the last one going releases the folder. Note that
// react-navigation pauses screens further than one back, which unmounts effects
// and so releases too -- deliberate: drilling away from a half-typed rename
// drops it rather than leaving it to resurrect onto whatever later takes the
// name.
const editPathOwners = new Map<T.FS.Path, number>()

const claimEditPath = (path: T.FS.Path) => {
  editPathOwners.set(path, (editPathOwners.get(path) ?? 0) + 1)
}

const releaseEditPath = (path: T.FS.Path) => {
  const claimed = editPathOwners.get(path) ?? 0
  if (!claimed) {
    // a release with no live claim behind it says nothing about the folder
    return
  }
  const remaining = claimed - 1
  if (remaining > 0) {
    editPathOwners.set(path, remaining)
    return
  }
  editPathOwners.delete(path)
  setBrowserEditState(prevState => {
    const orphaned = [...prevState.edits]
      .filter(([, edit]) => edit.parentPath === path)
      .map(([editID]) => editID)
    if (!orphaned.length) {
      return prevState
    }
    const nextEdits = new Map(prevState.edits)
    const nextSubmitting = new Set(prevState.submitting)
    orphaned.forEach(editID => {
      nextEdits.delete(editID)
      nextSubmitting.delete(editID)
    })
    return {edits: nextEdits, submitting: nextSubmitting}
  })
}

const addBrowserEditProvider = () => {
  ++browserEditProviderCount
}

const removeBrowserEditProvider = () => {
  --browserEditProviderCount
  if (!browserEditProviderCount) {
    resetBrowserEditState()
  }
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

// A rename that collides with an existing name is recoverable: keep the edit
// open and show the message so the user can pick another name.
const renameConflictCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsdirnotempty,
  T.RPCGen.StatusCode.scsimplefsnameexists,
]

export const getRenameConflictError = (edit: T.FS.Edit, error: unknown): string | undefined =>
  edit.type === T.FS.EditType.Rename &&
  error instanceof RPCError &&
  renameConflictCodes.includes(error.code)
    ? error.desc || 'name exists'
    : undefined

export const pickNewFolderName = (
  siblingNames: ReadonlySet<string>,
  pendingEditNames: ReadonlySet<string>
): string => {
  let name = 'New Folder'
  let i = 2
  while (siblingNames.has(name) || pendingEditNames.has(name)) {
    name = `New Folder ${i}`
    ++i
  }
  return name
}

const commitEditRPC = async (
  edit: T.FS.Edit,
  editID: T.FS.EditID,
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
) => {
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
    const conflict = getRenameConflictError(edit, error)
    if (conflict !== undefined) {
      // the edit can be gone by now -- cancelled, swept, or dropped with its
      // screen -- and reporting the conflict must not bring it back
      setBrowserEdits(prevEdits =>
        prevEdits.has(editID) ? addOrReplaceEdit(prevEdits, editID, {...edit, error: conflict}) : prevEdits
      )
      return
    }
    errorToActionOrThrow(error, edit.parentPath)
  } finally {
    setBrowserSubmitting(prevSubmitting => deleteSubmitting(prevSubmitting, editID))
  }
}

// The edit store is global but every mounted fs screen has its own provider, and
// on mobile several are mounted at once (the Files tab root plus every pushed
// fsBrowse folder). Retiring an edit therefore takes two things: the screen must
// own the folder, and it must hold a complete listing of it. Owning it is not
// implied by having it loaded -- a recursive listing stamps every direct
// subfolder Loaded with a point-in-time child set, so a parent screen can hold a
// stale listing of a folder someone else is browsing. Only the folder's own
// screen may judge, and only a Loaded listing proves the name is really gone.
export const getStaleRenameEditIDs = (
  edits: ReadonlyMap<T.FS.EditID, T.FS.Edit>,
  pathItems: T.FS.PathItems,
  ownedPath: T.FS.Path
): ReadonlySet<T.FS.EditID> => {
  const stale = new Set<T.FS.EditID>()
  edits.forEach((edit, editID) => {
    if (edit.type !== T.FS.EditType.Rename || edit.parentPath !== ownedPath) {
      return
    }
    const parent = Constants.getPathItem(pathItems, edit.parentPath)
    if (parent.type !== T.FS.PathType.Folder || parent.progress !== T.FS.ProgressType.Loaded) {
      return
    }
    if (!parent.children.has(edit.originalName)) {
      stale.add(editID)
    }
  })
  return stale
}

export const FsBrowserEditProvider = ({children, path}: {children: React.ReactNode; path: T.FS.Path}) => {
  const errorToActionOrThrow = useFsErrorActionOrThrow()
  const {edits, submitting} = React.useSyncExternalStore(
    subscribeBrowserEditState,
    getBrowserEditStateSnapshot,
    getBrowserEditStateSnapshot
  )
  const pathItems = useFsLoadedPathItems()

  React.useEffect(() => {
    addBrowserEditProvider()
    return removeBrowserEditProvider
  }, [])

  React.useEffect(() => {
    claimEditPath(path)
    return () => {
      releaseEditPath(path)
    }
  }, [path])

  React.useEffect(() => {
    const staleEditIDs = getStaleRenameEditIDs(edits, pathItems, path)
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
  }, [edits, path, pathItems])

  const commitEdit = (editID: T.FS.EditID) => {
    const edit = edits.get(editID)
    if (!edit) {
      return
    }
    setBrowserSubmitting(prevSubmitting => addSubmitting(prevSubmitting, editID))
    ignorePromise(commitEditRPC(edit, editID, errorToActionOrThrow))
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

    const newFolderName = pickNewFolderName(
      parentPathItem.children,
      new Set([...edits.values()].map(({name}) => name))
    )

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
    <BrowserEditContext value={{edits: sessions, newFolderRow, startRename}}>
      {children}
    </BrowserEditContext>
  )
}
