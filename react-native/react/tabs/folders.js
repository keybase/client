'use strict'
/* @flow */

import BaseComponent from "../base-component"
import Render from "./folders-render"

export default class Folders extends BaseComponent {
  constructor (props) {
    super(props)
  }
  render () {
    return Render.apply(this)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'Folders'
      }
    }
  }
}
