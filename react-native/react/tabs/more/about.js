'use strict'
/* @flow */

import React from '../../base-react'
import BaseComponent from '../../base-component'
import AboutRender from './about-render'

export default class About extends BaseComponent {
  constructor (props) {
    super(props)

    this.state = {}
  }

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
