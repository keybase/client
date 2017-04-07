// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'

import type {RouteProps} from '../../../route-tree/render-route'
import type {Connector} from 'react-redux'
import type {TypedState} from '../../../constants/reducer'

class UsernameOrEmail extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

type OwnProps = {}

const connector: Connector<RouteProps<OwnProps, {}>, {waitingForResponse: $PropertyType<Props, 'waitingForResponse'>} & OwnProps> = connect(
  (state: TypedState) => ({
    waitingForResponse: state.login.waitingForResponse,
  }),
  (dispatch) => ({
    onBack: () => dispatch(Creators.onBack()),
    onSubmit: (usernameOrEmail: string) => dispatch(Creators.submitUsernameOrEmail(usernameOrEmail)),
  })
)

export default connector(UsernameOrEmail)
