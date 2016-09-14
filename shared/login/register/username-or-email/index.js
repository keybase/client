// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'

import type {Connector} from 'react-redux'
import type {TypedState} from '../../../constants/reducer'

class UsernameOrEmail extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

type OwnProps = {
  onSubmit: (usernameOrEmail: string) => void,
  onBack: () => void,
}

const connector: Connector<OwnProps, {waitingForResponse: $PropertyType<Props, 'waitingForResponse'>} & OwnProps> = connect(
  (state: TypedState, op: OwnProps) => ({waitingForResponse: state.login.waitingForResponse})
)

export default connector(UsernameOrEmail)
