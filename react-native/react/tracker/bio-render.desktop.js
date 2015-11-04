'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'

export default class BioRender extends BaseComponent {
  render () {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', marginRight: 40}}>
        <h1 style={{backgroundColor: 'blue', width: 100, height: 100}}>Image</h1>
        <h1>Username</h1>
        <h1>Full Name</h1>
        <h1>Followers stuff</h1>
        <h1>location</h1>
        <h1>follows you</h1>
      </div>
    )
  }
}
