import * as ConfigGen from '../../actions/config-gen'
import * as Constants from '../../constants/config'
import * as Container from '../../util/container'
import * as Platform from '../../constants/platform'
import * as React from 'react'
import * as RouteTreeGen from '../../actions/route-tree-gen'
import GlobalError from '.'
import {settingsTab} from '../../constants/tabs'

const Connected = () => {
  const loggedIn = Container.useSelector(s => s.config.loggedIn)
  const daemonError = Constants.useConfigState(s => s.daemonError)
  const error = Container.useSelector(s => s.config.globalError)
  const dispatch = Container.useDispatch()

  const onFeedback = React.useCallback(() => {
    dispatch(ConfigGen.createGlobalError({}))
    if (loggedIn) {
      dispatch(RouteTreeGen.createClearModals())
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
  }, [loggedIn, dispatch])
  const copyToClipboard = React.useCallback(
    (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    [dispatch]
  )
  const onDismiss = React.useCallback(() => {
    dispatch(ConfigGen.createGlobalError({}))
  }, [dispatch])

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
