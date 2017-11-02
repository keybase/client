// @flow
import GlobalError from './index'
import {connect, type TypedState} from '../../util/container'
import * as ConfigGen from '../../actions/config-gen'

export default connect(
  (state: TypedState) => ({
    daemonError: state.config.daemonError,
    error: state.config.globalError,
  }),
  (dispatch: any) => ({
    onDismiss: () => dispatch(ConfigGen.createGlobalError({globalError: null})),
  })
)(GlobalError)
