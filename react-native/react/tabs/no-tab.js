'use strict'
/* @flow */

import BaseComponent from '../base-component'
import Render from './no-tab-render'

export default class NoTab extends BaseComponent {
  constructor (props) {
    super(props)
  }
  render () {
    return Render.apply(this)
  }

  static parseRoute (store, currentPath, nextPath) {
    return { }
  }
}
