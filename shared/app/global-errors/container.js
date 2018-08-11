// @flow
import GlobalError from './index'
import {connect, type TypedState, type TypedDispatch} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import * as RouteTreeGen from '../../actions/route-tree-gen'

const mapStateToProps = (state: TypedState) => ({
  daemonError: state.config.daemonError,
  debugDump: state.config.debugDump,
  error: state.config.globalError,
})

const mapDispatchToProps = (dispatch: TypedDispatch) => ({
  onDismiss: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
    dispatch(ConfigGen.createDebugDump({items: []}))
  },
  onFeedback: () => {
    dispatch(ConfigGen.createGlobalError({globalError: null}))
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
  },
})

export default connect(mapStateToProps, mapDispatchToProps)(GlobalError)
