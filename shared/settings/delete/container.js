// @flow
// import React from 'react'
import {connect} from 'react-redux'
// import Delete from './index'

import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

const DeleteContainer = (props: Props) => (
  null
  // <Delete {...props} />
)

export default connect(
  (state: TypedState, ownProps: {}) => ({}),
  (dispatch: any, ownProps: {}) => ({}),
)(DeleteContainer)
