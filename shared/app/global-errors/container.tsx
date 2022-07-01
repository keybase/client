import GlobalError from '.'
import * as Container from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import * as Platform from '../../constants/platform'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {}

const Connected = Container.connect(
  state => {
    const {loggedIn, daemonError, globalError} = state.config
    return {
      _loggedIn: loggedIn,
      daemonError,
      error: globalError,
    }
  },
  dispatch => ({
    _onFeedback: (loggedIn: boolean) => {
      dispatch(ConfigGen.createGlobalError({}))
      if (loggedIn) {
        dispatch(RouteTreeGen.createClearModals())
        if (Platform.isMobile) {
          dispatch(RouteTreeGen.createNavigateAppend({path: [settingsTab]}))
          dispatch(
            RouteTreeGen.createNavigateAppend({
              path: [
                {
                  props: {heading: 'Oh no, a bug!'},
                  selected: require('../../constants/settings').feedbackTab,
                },
              ],
            })
          )
        } else {
          dispatch(RouteTreeGen.createNavigateAppend({path: ['modalFeedback']}))
        }
      } else {
        dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
      }
    },
    copyToClipboard: (text: string) => dispatch(ConfigGen.createCopyToClipboard({text})),
    onDismiss: () => {
      dispatch(ConfigGen.createGlobalError({}))
    },
  }),
  (stateProps, dispatchProps, _: OwnProps) => {
    const {daemonError, error, _loggedIn} = stateProps
    const {copyToClipboard, onDismiss, _onFeedback} = dispatchProps
    return {
      copyToClipboard,
      daemonError,
      error,
      onDismiss,
      onFeedback: () => _onFeedback(_loggedIn),
    }
  }
)(GlobalError)
export default Connected
