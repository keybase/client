// @flow
import GlobalError from './index'
import {connect} from 'react-redux'
import {globalErrorDismiss} from '../constants/config'

import type {TypedState} from '../constants/reducer'

export default connect(
  (state: TypedState) => ({
    error: state.config.globalError,
    daemonError: state.config.daemonError,
  }),
  (dispatch: any) => ({
    onDismiss: () => dispatch({type: globalErrorDismiss}),
  })
)(GlobalError)
