'use strict'

import React, { Component } from '../../base-react'
import AboutRender from './about-render'

export default class About extends Component {
  // TODO get version from golang
  render () {
    return <AboutRender />
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
