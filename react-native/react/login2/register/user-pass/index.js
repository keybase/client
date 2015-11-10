'use strict'
/* @flow */

import React, {Component} from '../../../base-react'
import Render from './index.render'

export default class UserPass extends Component {
  render () {
    return (
      <Render
        buttonEnabled={(user, pass) => user && user.length && pass && pass.length}
        onSubmit={ (user, pass) => this.props.onSubmit(user, pass) }
        {...this.props}
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
