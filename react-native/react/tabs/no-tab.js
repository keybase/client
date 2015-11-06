'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import NoTabRender from './no-tab-render'

export default class NoTab extends BaseComponent {
  render () {
    return <NoTabRender />
  }

  static parseRoute (store, currentPath, nextPath) {
    return { }
  }
}
