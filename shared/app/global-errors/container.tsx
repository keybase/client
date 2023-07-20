import * as Constants from '../../constants/config'
import * as RouterConstants from '../../constants/router2'
import * as Container from '../../util/container'
import * as Platform from '../../constants/platform'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import GlobalError from '.'
import {settingsTab} from '../../constants/tabs'

const Connected = () => {
  const loggedIn = Constants.useConfigState(s => s.loggedIn)
  const daemonError = Constants.useDaemonState(s => s.error)
  const error = Constants.useConfigState(s => s.globalError)
  const setGlobalError = Constants.useConfigState(s => s.dispatch.setGlobalError)
  const dispatch = Container.useDispatch()

  const clearModals = RouterConstants.useState(s => s.dispatch.clearModals)
  const onFeedback = React.useCallback(() => {
    setGlobalError()
    if (loggedIn) {
      clearModals()
      if (Platform.isMobile) {
        dispatch(RouteTreeGen.createNavigateAppend({path: [settingsTab]}))
        dispatch(
          RouteTreeGen.createNavigateAppend({
            path: [
              {
                props: {},
                selected: require('../../constants/settings').feedbackTab,
              },
            ],
          })
        )
      } else {
        dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'modalFeedback'}]}))
      }
    } else {
      dispatch(RouteTreeGen.createNavigateAppend({path: [{props: {}, selected: 'feedback'}]}))
    }
  }, [clearModals, loggedIn, dispatch, setGlobalError])
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
