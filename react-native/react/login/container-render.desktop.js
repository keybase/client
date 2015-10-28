'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class LoginContainer extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return (<div><p>login container {this.props.foo}</p></div>)
  }
}
