import * as C from '../../constants'
import * as React from 'react'

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
      if (C.isMobile) {
        navigateAppend(C.settingsTab)
        navigateAppend({
          props: {},
          selected: C.settingsFeedbackTab,
        })
      } else {
        navigateAppend({
          props: {},
          selected: C.settingsFeedbackTab,
        })
      }
    } else {
      navigateAppend({props: {}, selected: 'feedback'})
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onDismiss = () => {
    setGlobalError()
  }

  return {
    copyToClipboard,
    daemonError,
    error,
    onDismiss,
    onFeedback,
  }
}

export default useData
