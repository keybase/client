'use strict'
/* @flow */

import React from 'react'

export default function () {
  console.log('inside login container')
  console.log(this.props)
  console.log(this.state)
  return (<div><p>login container {this.props.foo}</p></div>)
}
