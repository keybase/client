'use strict'
/* @flow */

import React from '../base-react'
import BaseComponent from '../base-component'
import { Paper } from 'material-ui'

// TODO constants when integrating
const normal = 'normal'
const warning = 'warning'
const error = 'error'

export default class BioRender extends BaseComponent {
  render () {
    let userFlag = ''
    if (this.props.state === warning) {
      userFlag = ' (warning)'
    } else if (this.props.state === error) {
      userFlag = ' (error)'
    }
    return (
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', marginRight: 40, minWidth: 300, marginTop: 40}}>
        <Paper style={{overflow: 'hidden'}} zDepth={1} circle>
          <img src={this.props.avatar} style={{width: 100, height: 100}}/>
        </Paper>
        <p style={{height: 0}}>{this.props.username + userFlag}</p>
        <p style={{height: 0}}>{this.props.fullname}</p>
        <div style={{display: 'flex', alignSelf: 'stretch', justifyContent: 'space-around', paddingLeft: 20, paddingRight: 20}}>
          <p style={{height: 0}}>{this.props.followingCount} Following</p>
          <p style={{height: 0}}>{this.props.followersCount} Followers</p>
        </div>
        <p style={{height: 0}}>{this.props.location}</p>
        {this.props.followsYou && <p style={{height: 0}}>Follows you</p>}
      </div>
    )
  }
}

BioRender.propTypes = {
  state: React.PropTypes.oneOf([normal, warning, error]).isRequired,
  avatar: React.PropTypes.string.isRequired,
  username: React.PropTypes.string.isRequired,
  fullname: React.PropTypes.string.isRequired,
  followersCount: React.PropTypes.number.isRequired,
  followingCount: React.PropTypes.number.isRequired,
  followsYou: React.PropTypes.bool.isRequired,
  location: React.PropTypes.string.isRequired
}
