'use strict'
/* @flow */

import React from 'react'

export default function () {
  return (
    <div>
      <p> People goes here </p>
      <p onClick={() => this.setState({count: this.state.count + 1})}> Count: {this.state.count} </p>
      <p> I mean, it’s one banana, Michael. What could it cost? Ten dollars? </p>
    </div>
  )
}
