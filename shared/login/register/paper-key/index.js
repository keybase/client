// @flow
import React, {Component} from 'react'
import {connect} from 'react-redux'
import Render from './index.render'
import type {Props, State} from './index'

class PaperKey extends Component<void, Props, State> {
  props: Props;
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
        waitingForResponse={this.props.waitingForResponse}
      />
    )
  }
}

PaperKey.propTypes = {
  onSubmit: React.PropTypes.func.isRequired,
  onBack: React.PropTypes.func.isRequired,
}

export default connect(
  state => ({waitingForResponse: state.login.waitingForResponse})
)(PaperKey)
