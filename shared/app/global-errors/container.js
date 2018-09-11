// @flow
import GlobalError from '.'
import {connect} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'

const mapStateToProps = state => ({
  _loggedIn: state.config.loggedIn,
  daemonError: state.config.daemonError,
  debugDump: state.config.debugDump,
  error: state.config.globalError,
})

const mapDispatchToProps = dispatch => ({
  copyToClipboard: text => dispatch(ConfigGen.createCopyToClipboard({text})),
  onDismiss: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    dispatch(ConfigGen.createDebugDump({items: []}))
  },
  onFeedback: (loggedIn: boolean) => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    if (loggedIn) {
      dispatch(RouteTreeGen.createSwitchTo({path: [settingsTab]}))
      dispatch(
        RouteTreeGen.createNavigateTo({
          path: [
            {
              props: {heading: 'Oh no, a bug!'},
              selected: feedbackTab,
            },
          ],
          parentPath: [settingsTab],
        })
      )
    } else {
      dispatch(RouteTreeGen.createNavigateAppend({path: ['feedback']}))
    }
  },
})

const mergeProps = (stateProps, dispatchProps, ownProps) => ({
  ...ownProps,
  copyToClipboard: dispatchProps.copyToClipboard,
  daemonError: stateProps.daemonError,
  debugDump: stateProps.debugDump,
  error: stateProps.error,
  onDismiss: dispatchProps.onDismiss,
  onFeedback: () => dispatchProps.onFeedback(stateProps._loggedIn),
})

const Connected = connect(mapStateToProps, mapDispatchToProps, mergeProps)(GlobalError)
export default Connected
