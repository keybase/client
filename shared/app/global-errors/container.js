// @flow
import GlobalError from './index'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'
import {settingsTab} from '../../constants/tabs'
import {feedbackTab} from '../../constants/settings'
import {navigateTo, switchTo} from '../../actions/route-tree'

const mapStateToProps = (state: TypedState) => ({
  daemonError: state.config.daemonError,
  debugDump: state.config.debugDump,
  error: state.config.globalError,
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

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(GlobalError)
