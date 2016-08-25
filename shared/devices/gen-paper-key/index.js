// @flow
import HiddenString from '../../util/hidden-string'
import React, {Component} from 'react'
import Render from '../../login/signup/success/index.render'
import {connect} from 'react-redux'
import {generatePaperKey} from '../../actions/devices'
import {navigateUp} from '../../actions/router'

type State = {
  loading: boolean
}

type Props = {
  paperKey: HiddenString,
  generatePaperKey: () => void,
  onBack: () => void
}

class GenPaperKey extends Component<void, Props, State> {
  state: State;

  constructor (props) {
    super(props)

    this.state = {
      loading: true,
    }
  }

  componentWillMount () {
    this.props.generatePaperKey()
  }

  componentWillReceiveProps (nextProps) {
    if (nextProps.paperKey) {
      this.setState({loading: false})
    }
  }

  render () {
    if (this.state.loading) {
      return null // TODO
    }

    return (
      <Render
        paperkey={this.props.paperKey}
        waiting={false}
        onFinish={this.props.onBack}
        onBack={this.props.onBack}
        title='Paper key generated!'
      />
    )
  }

  static parseRoute () {
    return {componentAtTop: {}}
  }
}

export default connect(
  state => ({paperKey: state.devices.paperKey}),
  dispatch => {
    return {
      generatePaperKey: () => dispatch(generatePaperKey()),
      onBack: () => dispatch(navigateUp()),
    }
  }
)(GenPaperKey)
