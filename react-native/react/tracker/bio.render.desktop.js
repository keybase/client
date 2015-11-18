'use strict'
/* @flow */

// $FlowIssue base-react
import React, {Component} from '../base-react'
import {Paper} from 'material-ui'

import type {User} from '../constants/types/flow-types'

export type BioProps = {
  user: ?User,
  state: 'warning' | 'error' | 'pending',
  userInfo: ?{
    fullname: string,
    followersCount: number,
    followingCount: number,
    followsYou: boolean,
    avatar: string,
    location: string
  }
}

export default class BioRender extends Component {
  props: BioProps;

  render (): ReactElement {
    let userFlag = ''

    const { user, state, userInfo } = this.props

    if (state === 'warning') {
      userFlag = ' (warning)'
    } else if (state === 'error') {
      userFlag = ' (error)'
    }
    return (
      <div style={{display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'center', marginRight: 40, minWidth: 300, marginTop: 40}}>
        <Paper style={{overflow: 'hidden'}} zDepth={1} circle>
          <img src={userInfo && userInfo.avatar} style={{width: 100, height: 100}}/>
        </Paper>
        <p style={{height: 0}}>{user && (user.username + userFlag)}</p>
        <p style={{height: 0}}>{'TODO get full name...'}</p>
        <div style={{display: 'flex', alignSelf: 'stretch', justifyContent: 'space-around', paddingLeft: 20, paddingRight: 20}}>
          <p style={{height: 0}}>{userInfo ? userInfo.followingCount : '-'} Following</p>
          <p style={{height: 0}}>{userInfo ? userInfo.followersCount : '-'} Followers</p>
        </div>
        <p style={{height: 0}}>{userInfo ? userInfo.location : 'Loading...'}</p>
        {userInfo && userInfo.followsYou && <p style={{height: 0}}>Follows you</p>}
      </div>
    )
  }
}

BioRender.propTypes = {
  user: React.PropTypes.any,
  state: React.PropTypes.any,
  userInfo: React.PropTypes.any
}
