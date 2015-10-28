'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import PeopleRender from './people-render'

export default class People extends BaseComponent {
  constructor (props) {
    super(props)
  }

  render () {
    return <PeopleRender />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'People'
      }
    }
  }
}
