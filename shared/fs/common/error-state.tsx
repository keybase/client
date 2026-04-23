import * as React from 'react'
import type * as T from '@/constants/types'
import {errorToActionOrThrow, errorToActionOrThrowWithHandlers, useFSState} from '@/stores/fs'

const noopSubscribe = () => () => {}

type FsErrorContextType = {
  dismissRedbar: (index: number) => void
  errorToActionOrThrow: (error: unknown, path?: T.FS.Path) => void
  errors: ReadonlyArray<string>
  redbar: (error: string) => void
}

const FsErrorContext = React.createContext<FsErrorContextType | null>(null)

export const FsErrorProvider = ({children}: {children: React.ReactNode}) => {
  const [errors, setErrors] = React.useState<ReadonlyArray<string>>([])

  const dismissRedbar = (index: number) => {
    setErrors(prevErrors => [...prevErrors.slice(0, index), ...prevErrors.slice(index + 1)])
  }

  const redbar = (error: string) => {
    setErrors(prevErrors => [...prevErrors, error])
  }

  const handleError = (error: unknown, path?: T.FS.Path) => {
    const {checkKbfsDaemonRpcStatus, setPathSoftError, setTlfSoftError} = useFSState.getState().dispatch
    errorToActionOrThrowWithHandlers(
      {checkKbfsDaemonRpcStatus, redbar, setPathSoftError, setTlfSoftError},
      error,
      path
    )
  }

  return (
    <FsErrorContext.Provider value={{dismissRedbar, errorToActionOrThrow: handleError, errors, redbar}}>
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
