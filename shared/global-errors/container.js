// @flow
import GlobalError from './index'
import {connect} from 'react-redux'
import {globalErrorDismiss} from '../constants/config'

import type {TypedState} from '../constants/reducer'

export default connect(
  (state: TypedState) => ({
    daemonError: state.config.daemonError,
    error: state.config.globalError,
  }),
  (dispatch: any) => ({
    onDismiss: () => dispatch({type: globalErrorDismiss}),
  })
)(GlobalError)
