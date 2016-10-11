// @flow
import GlobalError from './index'
import {connect} from 'react-redux'
import {globalErrorDismiss} from '../constants/config'

import type {TypedState} from '../constants/reducer'

export default connect(
  (state: TypedState) => ({
    summary: state.config.globalError && state.config.globalError.summary,
    details: state.config.globalError && state.config.globalError.details,
  }),
  (dispatch: any) => ({
    onDismiss: () => dispatch({type: globalErrorDismiss}),
  })
)(GlobalError)
