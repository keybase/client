import GlobalError from '.'
import {connect} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'

type OwnProps = {}

const mapStateToProps = state => ({
  _loggedIn: state.config.loggedIn,
  daemonError: state.config.daemonError,
  error: state.config.globalError,
})

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  onDismiss: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
  },
  onFeedback: (loggedIn: boolean) => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    if (loggedIn) {
      dispatch(RouteTreeGen.createClearModals())
      dispatch(RouteTreeGen.createNavigateAppend({path: [settingsTab]}))
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [
            {
              props: {heading: 'Oh no, a bug!'},
              selected: feedbackTab,
            },
          ],
        })
      )
    } else {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, _: OwnProps) => ({
  copyToClipboard: dispatchProps.copyToClipboard,
  daemonError: stateProps.daemonError,
  error: stateProps.error,
  onDismiss: dispatchProps.onDismiss,
  onFeedback: () => dispatchProps.onFeedback(stateProps._loggedIn),
})

const Connected = connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)(GlobalError)
export default Connected
