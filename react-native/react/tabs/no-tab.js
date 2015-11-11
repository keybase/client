'use strict'
/* @flow */

import React, { Component } from '../base-react'
import NoTabRender from './no-tab-render'

export default class NoTab extends Component {
  render () {
    return <NoTabRender />
  }

  static parseRoute (store, currentPath, nextPath) {
    return { }
  }
}
