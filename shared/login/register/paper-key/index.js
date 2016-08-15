// @flow
import React, {Component} from 'react'
import Render from './index.render'
import type {Props, State} from './index'
import {connect} from 'react-redux'

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
      <Render
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

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse})
)(PaperKey)
