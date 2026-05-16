import * as React from 'react'
import * as Constants from '@/constants/fs'
import * as T from '@/constants/types'
import {ensureError} from '@/util/errors'
import {useConfigState} from '@/stores/config'
import {useFsDaemonActions} from './daemon'
import isObject from 'lodash/isObject'

const noopSoftError = () => {}
const noopDismissRedbar = (_index: number) => {}
const emptyErrors: ReadonlyArray<string> = []
const noAccessErrorCodes: Array<T.RPCGen.StatusCode> = [
  T.RPCGen.StatusCode.scsimplefsnoaccess,
  T.RPCGen.StatusCode.scteamnotfound,
  T.RPCGen.StatusCode.scteamreaderror,
]

type ErrorHandlers = {
  checkKbfsDaemonRpcStatus: () => void
  redbar: (error: string) => void
  setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
}

const redbarToGlobalError = (error: string) => {
  useConfigState.getState().dispatch.setGlobalError(new Error(error))
}

export const errorToActionOrThrowWithHandlers = (
  {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError}: ErrorHandlers,
  error: unknown,
  path?: T.FS.Path
) => {
  if (!isObject(error)) return
  const code = (error as {code?: T.RPCGen.StatusCode}).code
  if (code === T.RPCGen.StatusCode.sckbfsclienttimeout) {
    checkKbfsDaemonRpcStatus()
    return
  }
  if (code === T.RPCGen.StatusCode.scidentifiesfailed) {
    // This is specifically to address the situation where when user tries to
    // remove a shared TLF from their favorites but another user of the TLF has
    // deleted their account the subscribePath call cauused from the popup will
    // get SCIdentifiesFailed error. We can't do anything here so just move on.
    // (Ideally we'd be able to tell it's becaue the user was deleted, but we
    // don't have that from Go right now.)
    //
    // TODO: TRIAGE-2379 this should probably be ignored on Go side. We
    // already use fsGui identifyBehavior and there's no reason we should get
    // an identify error here.
    return undefined
  }
  if (path && code === T.RPCGen.StatusCode.scsimplefsnotexist) {
    setPathSoftError(path, T.FS.SoftError.Nonexistent)
    return
  }
  if (path && code && noAccessErrorCodes.includes(code)) {
    const tlfPath = Constants.getTlfPath(path)
    if (tlfPath) {
      setTlfSoftError(tlfPath, T.FS.SoftError.NoAccess)
      return
    }
  }
  if (code === T.RPCGen.StatusCode.scdeleted) {
    // The user is deleted. Let user know and move on.
    redbar('A user in this shared folder has deleted their account.')
    return
  }
  throw ensureError(error)
}

const makeEmptySoftErrors = (): T.FS.SoftErrors => ({
  pathErrors: new Map(),
  tlfErrors: new Map(),
})

type FsErrorContextType = {
  dismissRedbar: (index: number) => void
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
  errors: ReadonlyArray<string>
  redbar: (error: string) => void
  setPathSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  setTlfSoftError: (path: T.FS.Path, softError?: T.FS.SoftError) => void
  softErrors: T.FS.SoftErrors
}

const FsErrorContext = React.createContext<FsErrorContextType | null>(null)

export const FsErrorProvider = ({children}: {children: React.ReactNode}) => {
  const {checkKbfsDaemonRpcStatus} = useFsDaemonActions()
  const [errors, setErrors] = React.useState<ReadonlyArray<string>>([])
  const [softErrors, setSoftErrors] = React.useState<T.FS.SoftErrors>(makeEmptySoftErrors)

  const dismissRedbar = (index: number) => {
    setErrors(prevErrors => [...prevErrors.slice(0, index), ...prevErrors.slice(index + 1)])
  }

  const redbar = (error: string) => {
    setErrors(prevErrors => [...prevErrors, error])
  }

  const setPathSoftError = (path: T.FS.Path, softError?: T.FS.SoftError) => {
    setSoftErrors(prevSoftErrors => {
      const pathErrors = new Map(prevSoftErrors.pathErrors)
      if (softError) {
        pathErrors.set(path, softError)
      } else {
        pathErrors.delete(path)
      }
      return {...prevSoftErrors, pathErrors}
    })
  }

  const setTlfSoftError = (path: T.FS.Path, softError?: T.FS.SoftError) => {
    setSoftErrors(prevSoftErrors => {
      const tlfErrors = new Map(prevSoftErrors.tlfErrors)
      if (softError) {
        tlfErrors.set(path, softError)
      } else {
        tlfErrors.delete(path)
      }
      return {...prevSoftErrors, tlfErrors}
    })
  }

  const handleError = React.useEffectEvent((error: unknown, path?: T.FS.Path) => {
    errorToActionOrThrowWithHandlers(
      {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError},
      error,
      path
    )
  })

  return (
    <FsErrorContext.Provider
      value={{
        dismissRedbar,
        errorToActionOrThrow: handleError,
        errors,
        redbar,
        setPathSoftError,
        setTlfSoftError,
        softErrors,
      }}
    >
      {children}
    </FsErrorContext.Provider>
  )
}

export const useFsErrors = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return routeErrors?.errors ?? emptyErrors
}

export const useFsRedbarActions = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return routeErrors
    ? {
        dismissRedbar: routeErrors.dismissRedbar,
        redbar: routeErrors.redbar,
      }
    : {
        dismissRedbar: noopDismissRedbar,
        redbar: redbarToGlobalError,
      }
}

export const useFsErrorActionOrThrow = () => {
  const {checkKbfsDaemonRpcStatus} = useFsDaemonActions()
  const routeErrors = React.useContext(FsErrorContext)
  const defaultErrorToActionOrThrow = React.useEffectEvent((error: unknown, path?: T.FS.Path) => {
    errorToActionOrThrowWithHandlers(
      {
        checkKbfsDaemonRpcStatus,
        redbar: redbarToGlobalError,
        setPathSoftError: noopSoftError,
        setTlfSoftError: noopSoftError,
      },
      error,
      path
    )
  })
  return routeErrors?.errorToActionOrThrow ?? defaultErrorToActionOrThrow
}

export const useFsSoftErrors = () => React.useContext(FsErrorContext)?.softErrors

export const useFsSoftErrorActions = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return {
    setPathSoftError: routeErrors?.setPathSoftError ?? noopSoftError,
    setTlfSoftError: routeErrors?.setTlfSoftError ?? noopSoftError,
  }
}
