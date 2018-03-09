// @flow
import GlobalError from './index'
import {connect, type TypedState, type Dispatch} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'

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
})

export default connect(mapStateToProps, mapDispatchToProps)(GlobalError)
