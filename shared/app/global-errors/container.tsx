import * as C from '../../constants'
import * as Platform from '../../constants/platform'
import * as React from 'react'
import GlobalError from '.'
import {settingsTab} from '../../constants/tabs'

const Connected = () => {
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
      if (Platform.isMobile) {
        navigateAppend(settingsTab)
        navigateAppend({
          props: {},
          selected: C.feedbackTab,
        })
      } else {
        navigateAppend({props: {}, selected: 'modalFeedback'})
      }
    } else {
      navigateAppend({props: {}, selected: 'feedback'})
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const copyToClipboard = C.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
  const onDismiss = setGlobalError

  if (daemonError || error) {
    return (
      <GlobalError
        copyToClipboard={copyToClipboard}
        daemonError={daemonError}
        error={error}
        onDismiss={onDismiss}
        onFeedback={onFeedback}
      />
    )
  }
  return null
}
export default Connected
