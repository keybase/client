'use strict'

import React, { Component } from '../base-react'
import FoldersRender from './folders-render'

export default class Folders extends Component {
  render () {
    return <FoldersRender />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Folders'
      }
    }
  }
}
