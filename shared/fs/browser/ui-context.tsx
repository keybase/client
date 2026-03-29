import * as React from 'react'
import * as S from '@/constants/strings'
import * as T from '@/constants/types'
import {ignorePromise} from '@/constants/utils'
import {RPCError} from '@/util/errors'
import {makeUUID} from '@/util/uuid'
import {useFSState, errorToActionOrThrow, makeEditID} from '@/stores/fs'
import * as FS from '@/stores/fs'

type EditContextValue = {
  commitEdit: (editID: T.FS.EditID) => void
  discardEdit: (editID: T.FS.EditID) => void
  edits: ReadonlyMap<T.FS.EditID, T.FS.Edit>
  newFolderRow: (parentPath: T.FS.Path) => void
  setEditName: (editID: T.FS.EditID, name: string) => void
  startRename: (path: T.FS.Path) => void
}

const EditContext = React.createContext<EditContextValue | undefined>(undefined)

type ProviderProps = {
  children: React.ReactNode
}

export const EditProvider = ({children}: ProviderProps) => {
  const pathItems = useFSState(s => s.pathItems)
  const [edits, setEdits] = React.useState<ReadonlyMap<T.FS.EditID, T.FS.Edit>>(new Map())
  const editsRef = React.useRef(edits)
  const pathItemsRef = React.useRef(pathItems)

  React.useEffect(() => {
    editsRef.current = edits
  }, [edits])

  React.useEffect(() => {
    pathItemsRef.current = pathItems
  }, [pathItems])

  const commitEdit = React.useCallback((editID: T.FS.EditID) => {
    const edit = editsRef.current.get(editID)
    if (!edit) {
      return
    }
    const f = async () => {
      switch (edit.type) {
        case T.FS.EditType.NewFolder:
          try {
            await T.RPCGen.SimpleFSSimpleFSOpenRpcPromise(
              {
                dest: FS.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
                flags: T.RPCGen.OpenFlags.directory,
                opID: makeUUID(),
              },
              S.waitingKeyFSCommitEdit
            )
            setEdits(prev => {
              const next = new Map(prev)
              next.delete(editID)
              return next
            })
          } catch (error) {
            errorToActionOrThrow(error, edit.parentPath)
          }
          return
        case T.FS.EditType.Rename:
          try {
            const opID = makeUUID()
            await T.RPCGen.SimpleFSSimpleFSMoveRpcPromise({
              dest: FS.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.name)),
              opID,
              overwriteExistingFiles: false,
              src: FS.pathToRPCPath(T.FS.pathConcat(edit.parentPath, edit.originalName)),
            })
            await T.RPCGen.SimpleFSSimpleFSWaitRpcPromise({opID}, S.waitingKeyFSCommitEdit)
            setEdits(prev => {
              const next = new Map(prev)
              next.delete(editID)
              return next
            })
          } catch (error) {
            if (
              error instanceof RPCError &&
              [T.RPCGen.StatusCode.scsimplefsnameexists, T.RPCGen.StatusCode.scsimplefsdirnotempty].includes(
                error.code
              )
            ) {
              setEdits(prev => {
                const next = new Map(prev)
                const current = next.get(editID)
                current && next.set(editID, {...current, error: error.desc || 'name exists'})
                return next
              })
              return
            }
            errorToActionOrThrow(error, edit.parentPath)
          }
      }
    }
    ignorePromise(f())
  }, [])

  const discardEdit = React.useCallback((editID: T.FS.EditID) => {
    setEdits(prev => {
      const next = new Map(prev)
      next.delete(editID)
      return next
    })
  }, [])

  const newFolderRow = React.useCallback((parentPath: T.FS.Path) => {
    const parentPathItem = FS.getPathItem(pathItemsRef.current, parentPath)
    if (parentPathItem.type !== T.FS.PathType.Folder) {
      console.warn(`bad parentPath: ${parentPathItem.type}`)
      return
    }

    const existingNewFolderNames = new Set([...editsRef.current.values()].map(({name}) => name))

    let newFolderName = 'New Folder'
    let i = 2
    while (parentPathItem.children.has(newFolderName) || existingNewFolderNames.has(newFolderName)) {
      newFolderName = `New Folder ${i}`
      ++i
    }

    setEdits(prev => {
      const next = new Map(prev)
      next.set(makeEditID(), {
        ...FS.emptyNewFolder,
        name: newFolderName,
        originalName: newFolderName,
        parentPath,
      })
      return next
    })
  }, [])

  const setEditName = React.useCallback((editID: T.FS.EditID, name: string) => {
    setEdits(prev => {
      const current = prev.get(editID)
      if (!current || current.name === name) {
        return prev
      }
      const next = new Map(prev)
      next.set(editID, {...current, error: undefined, name})
      return next
    })
  }, [])

  const startRename = React.useCallback((path: T.FS.Path) => {
    const parentPath = T.FS.getPathParent(path)
    const originalName = T.FS.getPathName(path)
    setEdits(prev => {
      const next = new Map(prev)
      next.set(makeEditID(), {
        name: originalName,
        originalName,
        parentPath,
        type: T.FS.EditType.Rename,
      })
      return next
    })
  }, [])

  const value = {
    commitEdit,
    discardEdit,
    edits,
    newFolderRow,
    setEditName,
    startRename,
  } satisfies EditContextValue

  return <EditContext.Provider value={value}>{children}</EditContext.Provider>
}

export const useEditContext = () => {
  const ctx = React.useContext(EditContext)
  if (!ctx) {
    throw new Error('useEditContext must be used within EditProvider')
  }
  return ctx
}
