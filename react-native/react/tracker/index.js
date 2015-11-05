'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import Render from './render'

export default class Tracker extends BaseComponent {
  render () {
    return <Render
      username='test12'
      reason='You accessed /private/cecile'
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
}
