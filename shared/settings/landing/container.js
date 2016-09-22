// @flow
// import React from 'react'
import {connect} from 'react-redux'
// import Landing from './index'

import type {TypedState} from '../../constants/reducer'
import type {Props} from './index'

const LandingContainer = (props: Props) => (
  null
  // <Landing {...props} />
)

export default connect(
  (state: TypedState, ownProps: {}) => ({}),
  (dispatch: any, ownProps: {}) => ({}),
)(LandingContainer)
