import * as Constants from '@/constants/fs'
import * as S from '@/constants/strings'
import {ignorePromise} from '@/constants/utils'
import * as React from 'react'
import * as T from '@/constants/types'
import {RPCError} from '@/util/errors'
import {errorToActionOrThrow, makeEditID, makeUUID, useFSState} from '@/stores/fs'

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

export const FsBrowserEditProvider = ({children}: {children: React.ReactNode}) => {
  const [edits, setEdits] = React.useState<ReadonlyMap<T.FS.EditID, T.FS.Edit>>(() => new Map())
  const [submitting, setSubmitting] = React.useState<ReadonlySet<T.FS.EditID>>(() => new Set())
  const editsRef = React.useRef(edits)
  editsRef.current = edits

  const commitEdit = (editID: T.FS.EditID) => {
    const edit = editsRef.current.get(editID)
    if (!edit) {
      return
    }
    setSubmitting(prevSubmitting => addSubmitting(prevSubmitting, editID))
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
        setEdits(prevEdits => deleteEdit(prevEdits, editID))
      } catch (error) {
        if (
          edit.type === T.FS.EditType.Rename &&
          error instanceof RPCError &&
          [T.RPCGen.StatusCode.scsimplefsdirnotempty, T.RPCGen.StatusCode.scsimplefsnameexists].includes(
            error.code
          )
        ) {
          setEdits(prevEdits =>
            addOrReplaceEdit(prevEdits, editID, {...edit, error: error.desc || 'name exists'})
          )
          return
        }
        errorToActionOrThrow(error, edit.parentPath)
      } finally {
        setSubmitting(prevSubmitting => deleteSubmitting(prevSubmitting, editID))
      }
    }
    ignorePromise(f())
  }

  const discardEdit = (editID: T.FS.EditID) => {
    setEdits(prevEdits => deleteEdit(prevEdits, editID))
    setSubmitting(prevSubmitting => deleteSubmitting(prevSubmitting, editID))
  }

  const setEditName = (editID: T.FS.EditID, name: string) => {
    setEdits(prevEdits => {
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
    setEdits(prevEdits =>
      addOrReplaceEdit(prevEdits, makeEditID(), {
        name: originalName,
        originalName,
        parentPath,
        type: T.FS.EditType.Rename,
      })
    )
  }

  const newFolderRow = (parentPath: T.FS.Path) => {
    const parentPathItem = Constants.getPathItem(useFSState.getState().pathItems, parentPath)
    if (parentPathItem.type !== T.FS.PathType.Folder) {
      console.warn(`bad parentPath: ${parentPathItem.type}`)
      return
    }

    const existingNewFolderNames = new Set([
      ...[...editsRef.current.values()].map(({name}) => name),
      ...[...useFSState.getState().edits.values()].map(({name}) => name),
    ])

    let newFolderName = 'New Folder'
    let i = 2
    while (parentPathItem.children.has(newFolderName) || existingNewFolderNames.has(newFolderName)) {
      newFolderName = `New Folder ${i}`
      ++i
    }

    setEdits(prevEdits =>
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
