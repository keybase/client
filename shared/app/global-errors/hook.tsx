import * as C from '@/constants'
import * as React from 'react'
import type {RPCError} from '@/util/errors'

export type Size = 'Closed' | 'Small' | 'Big'

const summaryForError = (err?: Error | RPCError) => err?.message ?? ''
const detailsForError = (err?: Error | RPCError) => err?.stack ?? ''

const useData = () => {
  const loggedIn = C.useConfigState(s => s.loggedIn)
  const daemonError = C.useDaemonState(s => s.error)
  const error = C.useConfigState(s => s.globalError)
  const setGlobalError = C.useConfigState(s => s.dispatch.setGlobalError)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = React.useCallback(() => {
    setGlobalError()
    if (loggedIn) {
      clearModals()
      navigateAppend(C.Settings.settingsFeedbackTab)
    } else {
      navigateAppend('feedback')
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onDismiss = React.useCallback(() => {
    setGlobalError()
  }, [setGlobalError])

  const [cachedSummary, setSummary] = React.useState(summaryForError(error))
  const [cachedDetails, setDetails] = React.useState(detailsForError(error))
  const [size, setSize] = React.useState<Size>('Closed')
  const countdownTimerRef = React.useRef<ReturnType<typeof setTimeout>>()
  const newErrorTimerRef = React.useRef<ReturnType<typeof setTimeout>>()

  const clearCountdown = React.useCallback(() => {
    countdownTimerRef.current && clearTimeout(countdownTimerRef.current)
    countdownTimerRef.current = undefined
  }, [countdownTimerRef])

  const onExpandClick = React.useCallback(() => {
    setSize('Big')
    if (!C.isMobile) {
      clearCountdown()
    }
  }, [clearCountdown])

  C.useOnUnMountOnce(() => {
    clearCountdown()
    newErrorTimerRef.current && clearTimeout(newErrorTimerRef.current)
  })

  C.useOnMountOnce(() => {
    resetError(!!error)
  })

  const resetError = React.useCallback(
    (newError: boolean) => {
      setSize(newError ? 'Small' : 'Closed')
      if (!C.isMobile) {
        clearCountdown()
        if (newError) {
          countdownTimerRef.current = setTimeout(() => {
            onDismiss()
          }, 10000)
        }
      }
    },
    [clearCountdown, onDismiss]
  )

  const [lastError, setLastError] = React.useState(error)

  if (lastError !== error) {
    setLastError(error)
    newErrorTimerRef.current = setTimeout(
      () => {
        setDetails(detailsForError(error))
        if (!C.isMobile) {
          setSummary(summaryForError(error))
        }
      },
      error ? 0 : 7000
    ) // if it's set, do it immediately, if it's cleared set it in a bit
    resetError(!!error)
  }

  return {
    cachedDetails,
    cachedSummary,
    copyToClipboard,
    daemonError,
    error,
    onDismiss,
    onExpandClick,
    onFeedback,
    size,
  }
}

export default useData
