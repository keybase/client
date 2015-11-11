'use strict'

import React, { Component } from '../base-react'
import PeopleRender from './people-render'

export default class People extends Component {
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
