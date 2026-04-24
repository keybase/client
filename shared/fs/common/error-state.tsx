import * as React from 'react'
import type * as T from '@/constants/types'
import {errorToActionOrThrow, errorToActionOrThrowWithHandlers, useFSState} from '@/stores/fs'
import {useConfigState} from '@/stores/config'

const noopSoftError = () => {}
const noopDismissRedbar = (_index: number) => {}
const emptyErrors: ReadonlyArray<string> = []

const redbarToGlobalError = (error: string) => {
  useConfigState.getState().dispatch.setGlobalError(new Error(error))
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
