'use strict'
/* @flow */

import BaseComponent from '../base-component'
import Render from './people-render'

export default class People extends BaseComponent {
  constructor (props) {
    super(props)
    this.state = {count: 0}
  }

  render () {
    return Render.apply(this)
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'People'
      }
    }
  }
}
