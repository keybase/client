// @flow
import React, {Component} from 'react'
import RenderPaperKey from './index.render'
import {connect} from 'react-redux'
import * as Creators from '../../../actions/login/creators'
import HiddenString from '../../../util/hidden-string'

import type {RouteProps} from '../../../route-tree/render-route'
import type {Props, State} from './index'
import type {TypedState} from '../../../constants/reducer'

class PaperKey extends Component<void, Props, State> {
  state: State

  constructor(props) {
    super(props)

    this.state = {
      paperKey: '',
    }
  }

  render() {
    return (
      <RenderPaperKey
        onSubmit={() => this.props.onSubmit(this.state.paperKey)}
        onChangePaperKey={paperKey => this.setState({paperKey})}
        onBack={this.props.onBack}
        paperKey={this.state.paperKey}
        error={this.props.error}
        waitingForResponse={this.props.waitingForResponse}
      />
    )
  }
}

type OwnProps = RouteProps<
  {
    error: string,
  },
  {}
>

// $FlowIssue
export default connect(
  (state: TypedState, {routeProps: {error}}: OwnProps) => ({
    waitingForResponse: state.login.waitingForResponse,
    error,
  }),
  dispatch => ({
    onBack: () => dispatch(Creators.onBack()),
    onSubmit: paperkey =>
      dispatch(Creators.submitPassphrase(new HiddenString(paperkey), false)),
  })
)(PaperKey)
