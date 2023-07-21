import * as Constants from '../../constants/config'
import * as RouterConstants from '../../constants/router2'
import * as Platform from '../../constants/platform'
import * as React from 'react'
import GlobalError from '.'
import {settingsTab} from '../../constants/tabs'

const Connected = () => {
  const loggedIn = Constants.useConfigState(s => s.loggedIn)
  const daemonError = Constants.useDaemonState(s => s.error)
  const error = Constants.useConfigState(s => s.globalError)
  const setGlobalError = Constants.useConfigState(s => s.dispatch.setGlobalError)

  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const navigateAppend = RouterConstants.useState(s => s.dispatch.navigateAppend)
  const onFeedback = React.useCallback(() => {
    setGlobalError()
    if (loggedIn) {
      clearModals()
      if (Platform.isMobile) {
        navigateAppend(settingsTab)
        navigateAppend({
          props: {},
          selected: require('../../constants/settings').feedbackTab,
        })
      } else {
        navigateAppend({props: {}, selected: 'modalFeedback'})
      }
    } else {
      navigateAppend({props: {}, selected: 'feedback'})
    }
  }, [navigateAppend, clearModals, loggedIn, setGlobalError])
  const copyToClipboard = Constants.useConfigState(s => s.dispatch.dynamic.copyToClipboard)
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
