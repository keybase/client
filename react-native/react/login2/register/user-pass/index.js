'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import Render from './index.render'

export default class UserPass extends Component {
  constructor (props) {
    super(props)

    this.state = {
      username: props.username || 'test13',
      passphrase: props.passphrase || 'okokokokokok'
    }
  }

  render () {
    const buttonEnabled = !!(this.state.username && this.state.username.length && this.state.passphrase && this.state.passphrase.length)
    return (
      <Render
        username={this.state.username}
        passphrase={this.state.passphrase}
        onChangeUsername={username => this.setState({username})}
        onChangePassphrase={passphrase => this.setState({passphrase})}
        buttonEnabled={buttonEnabled}
        onSubmit={() => this.props.onSubmit(this.state.username, this.state.passphrase)}
      />
    )
  }
}

UserPass.propTypes = {
  username: React.PropTypes.string,
  passphrase: React.PropTypes.string,
  error: React.PropTypes.object,
  onSubmit: React.PropTypes.func.isRequired,
  title: React.PropTypes.string,
  subTitle: React.PropTypes.string
}
