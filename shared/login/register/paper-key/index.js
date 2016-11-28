// @flow
import React, {Component} from 'react'
import RenderPaperKey from './index.render'
import {connect} from 'react-redux'

import type {RouteProps} from '../../../route-tree/render-route'
import type {Props, State} from './index'
import type {TypedState} from '../../../constants/reducer'

class PaperKey extends Component<void, Props, State> {
  state: State;

  constructor (props) {
    super(props)

    this.state = {
      paperKey: '',
    }
  }

  render () {
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

type OwnProps = RouteProps<{
  error: string,
  onBack: () => void,
  onSubmit: (paperkey: string) => void,
}, {}>

export default connect(
  (state: TypedState, {routeProps}: OwnProps) => ({
    ...routeProps,
    waitingForResponse: state.login.waitingForResponse,
  })
)(PaperKey)
