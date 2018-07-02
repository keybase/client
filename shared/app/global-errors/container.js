// @flow
import GlobalError from './index'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import {reachabilityReachable, constantsStatusCode} from '../../constants/types/rpc-gen'
import {navigateTo, switchTo} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  daemonError: state.config.daemonError,
  debugDump: state.config.debugDump,
  error: state.config.globalError,
  reachable: state.gregor.reachability.reachable,
})

const mapDispatchToProps = (dispatch: Dispatch) => ({
  onDismiss: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    dispatch(ConfigGen.createDebugDump({items: []}))
  },
  onFeedback: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    dispatch(switchTo([settingsTab]))
    dispatch(
      navigateTo(
        [
          {
            props: {heading: 'Oh no, a bug!'},
            selected: feedbackTab,
          },
        ],
        [settingsTab]
      )
    )
  },
})

const mergeProps = (stateProps, dispatchProps) => {
  let error = stateProps.error
  // If we're offline, ignore any API network errors.
  if (
    stateProps.reachable === reachabilityReachable.no &&
    error &&
    error.code === constantsStatusCode.scapinetworkerror
  ) {
    error = null
  }

  return {
    error,
    daemonError: stateProps.daemonError,
    debugDump: stateProps.debugDump,
    onDismiss: dispatchProps.onDismiss,
    onFeedback: dispatchProps.onFeedback,
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)(GlobalError)
