'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Component } from 'react'

export default class PeopleRender extends BaseComponent {
  constructor (props) {
    super(props)
    // FIXME: This state should live in the People component.
    this.state = {count: 0}
  }

  render () {
    return (
      <div>
        <p> People goes here </p>
        <p onClick={() => this.setState({count: this.state.count + 1})}> Count: {this.state.count} </p>
        <p> I mean, it’s one banana, Michael. What could it cost? Ten dollars? </p>
      </div>
    )
  }
}
