'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import PeopleRender from './people-render'

export default class People extends BaseComponent {
  constructor (props) {
    super(props)
    this.state = {count: 0}
  }

  handleCountIncrease () {
    this.setState({count: this.state.count + 1})
  }

  render () {
    return <PeopleRender
      count={this.state.count}
      onCount={() => this.handleCountIncrease()}
    />
  }

  static parseRoute (store, currentPath, nextPath) {
    return {
      componentAtTop: {
        title: 'People'
      }
    }
  }
}
