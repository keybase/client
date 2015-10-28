'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from "../base-component"
import FoldersRender from "./folders-render"

export default class Folders extends BaseComponent {
  constructor (props) {
    super(props)
  }

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
