'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import Render from './render'

import { navigateUp } from '../actions/router'

export default class Tracker extends BaseComponent {
  onClose () {
    this.props.dispatch(navigateUp()) // TODO
  }

  render () {
    return <Render
      username='test12'
      reason='You accessed /private/cecile'
      onClose={() => this.onClose()}
    />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Tracker'
      }
    }
  }
}

Tracker.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}
