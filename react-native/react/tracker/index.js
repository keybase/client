'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import Render from './render'

import { navigateUp } from '../actions/router'

export default class Tracker extends BaseComponent {
  render () {
    return <Render {...this.props} />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Tracker',
        // dummy data TODO
        props: {
          reason: 'You accessed /private/cecile',
          username: 'test12',
          onClose: () => store.dispatch(navigateUp()) // TODO
        }
      }
    }
  }
}

Tracker.propTypes = {
  dispatch: React.PropTypes.func.isRequired
}
