// @flow
import GlobalError from './index'
import {connect, type TypedState} from '../../util/container'
import {globalErrorDismiss} from '../../constants/config'

export default connect(
  (state: TypedState) => ({
    daemonError: state.config.daemonError,
    error: state.config.globalError,
  }),
  (dispatch: any) => ({
    onDismiss: () => dispatch({type: globalErrorDismiss}),
  })
)(GlobalError)
