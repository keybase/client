import * as React from 'react'
import type * as T from '@/constants/types'
import {errorToActionOrThrow, errorToActionOrThrowWithHandlers, useFSState} from '@/stores/fs'

const noopSubscribe = () => () => {}
const noopSoftError = () => {}

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

  const handleError = (error: unknown, path?: T.FS.Path) => {
    const {checkKbfsDaemonRpcStatus} = useFSState.getState().dispatch
    errorToActionOrThrowWithHandlers(
      {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError},
      error,
      path
    )
  }

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
  const storeErrors = React.useSyncExternalStore(
    routeErrors ? noopSubscribe : useFSState.subscribe,
    () => useFSState.getState().errors,
    () => useFSState.getState().errors
  )
  return routeErrors?.errors ?? storeErrors
}

export const useFsRedbarActions = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return routeErrors
    ? {
        dismissRedbar: routeErrors.dismissRedbar,
        redbar: routeErrors.redbar,
      }
    : {
        dismissRedbar: useFSState.getState().dispatch.dismissRedbar,
        redbar: useFSState.getState().dispatch.redbar,
      }
}

export const useFsErrorActionOrThrow = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return routeErrors?.errorToActionOrThrow ?? errorToActionOrThrow
}

export const useFsSoftErrors = () => React.useContext(FsErrorContext)?.softErrors

export const useFsSoftErrorActions = () => {
  const routeErrors = React.useContext(FsErrorContext)
  return {
    setPathSoftError: routeErrors?.setPathSoftError ?? noopSoftError,
    setTlfSoftError: routeErrors?.setTlfSoftError ?? noopSoftError,
  }
}
