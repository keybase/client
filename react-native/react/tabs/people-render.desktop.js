'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import Search from '../search/index.desktop'

export default class PeopleRender extends BaseComponent {
  render () {
    return (
      <div>
        <Search />

        <p> People goes here </p>
        <p onClick={this.props.onCount}> Count: {this.props.count} </p>
        <p> I mean, it’s one banana, Michael. What could it cost? Ten dollars? </p>
      </div>
    )
  }
}
