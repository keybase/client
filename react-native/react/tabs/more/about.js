'use strict'
/* @flow */

import React, { StyleSheet } from '../../base-react'
import BaseComponent from '../../base-component'
import Render from './about-render'

export default class About extends BaseComponent {
  constructor (props) {
    super(props)

    this.state = {}
  }

  // TODO get version from golang
  render () {
    return Render.apply(this)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'About'
      }
    }
  }
}

About.propTypes = {}
