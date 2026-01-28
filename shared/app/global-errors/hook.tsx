import * as C from '@/constants'
import * as React from 'react'
import {useConfigState} from '@/stores/config'
import type {RPCError} from '@/util/errors'
import {settingsFeedbackTab} from '@/constants/settings'
import {useDaemonState} from '@/stores/daemon'

export type Size = 'Closed' | 'Small' | 'Big'

const summaryForError = (err?: Error | RPCError) => err?.message ?? ''
const detailsForError = (err?: Error | RPCError) => err?.stack ?? ''

const useData = () => {
  const loggedIn = useConfigState(s => s.loggedIn)
  const daemonError = useDaemonState(s => s.error)
  const error = useConfigState(s => s.globalError)
  const setGlobalError = useConfigState(s => s.dispatch.setGlobalError)
  const clearModals = C.useRouterState(s => s.dispatch.clearModals)
  const navigateAppend = C.useRouterState(s => s.dispatch.navigateAppend)
  const onFeedback = React.useCallback(() => {
    setGlobalError()
    if (loggedIn) {
      clearModals()
      navigateAppend(settingsFeedbackTab)
    } else {
      navigateAppend('feedback')
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const copyToClipboard = useConfigState(s => s.dispatch.defer.copyToClipboard)
  const onDismiss = React.useCallback(() => {
    setGlobalError()
  }, [setGlobalError])

  const [cachedSummary, setSummary] = React.useState(summaryForError(error))
  const [cachedDetails, setDetails] = React.useState(detailsForError(error))
  const [size, setSize] = React.useState<Size>('Closed')
  const countdownTimerRef = React.useRef<undefined | ReturnType<typeof setTimeout>>(undefined)

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

  C.useOnUnMountOnce(() => {
    clearCountdown()
  })

  C.useOnMountOnce(() => {
    resetError(!!error)
  })

  React.useEffect(() => {
    const id = setTimeout(
      () => {
        setDetails(detailsForError(error))
        if (!C.isMobile) {
          setSummary(summaryForError(error))
        }
      },
      error ? 0 : 7000
    ) // if it's set, do it immediately, if it's cleared set it in a bit
    resetError(!!error)
    return () => {
      clearTimeout(id)
    }
  }, [error, resetError])

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
