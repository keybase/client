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

  // TODO(mm): annotate types
  // store is our redux store
  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        component: Folders,
        title: 'Folders'
      },
      parseNextRoute: null
    }
  }
}
