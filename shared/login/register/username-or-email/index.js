// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props} from './index.render'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'

import type {TypedState} from '../../../constants/reducer'

class UsernameOrEmail extends Component<void, Props, void> {
  render () {
    return <Render {...this.props} />
  }
}

// $FlowIssue
export default connect(
  (state: TypedState) => ({
    waitingForResponse: state.login.waitingForResponse,
  }),
  (dispatch) => ({
    onBack: () => dispatch(Creators.onBack()),
    onSubmit: (usernameOrEmail: string) => dispatch(Creators.submitUsernameOrEmail(usernameOrEmail)),
  })
)(UsernameOrEmail)
