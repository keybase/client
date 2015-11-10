'use strict'
/* @flow */

import React, { Component } from '../../base-react'
import { registerWithUserPass, registerWithPaperKey, registerWithExistingDevice } from '../../actions/login2'
import Render from './index.render'

export default class Register extends Component {
  render () {
    return (
      <Render {...this.props}/>
    )
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        props: {
          gotoExistingDevicePage: () => store.dispatch(registerWithExistingDevice()),
          gotoPaperKeyPage: () => store.dispatch(registerWithPaperKey()),
          gotoUserPassPage: () => store.dispatch(registerWithUserPass())
        }
      }
    }
  }
}

Register.propTypes = {
  gotoExistingDevicePage: React.PropTypes.func.isRequired,
  gotoPaperKeyPage: React.PropTypes.func.isRequired,
  gotoUserPassPage: React.PropTypes.func.isRequired
}
