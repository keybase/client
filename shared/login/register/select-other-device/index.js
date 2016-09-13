// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'

import type {TypedState} from '../../../constants/reducer'

class SelectOtherDevice extends Component<void, Props, void> {
  render () { return <Render {...this.props} /> }
}

type OwnProps = any

export default connect(
  (state: TypedState, ownProps: OwnProps) => ({}),
)(SelectOtherDevice)
