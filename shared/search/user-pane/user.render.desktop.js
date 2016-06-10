/* @flow */

import React, {Component} from 'react'
import {normal as proofNormal} from '../../constants/tracker'
import {Box, Button, FollowButton, UserProofs, UserBio} from '../../common-adapters'
import {globalColors, globalStyles, globalMargins} from '../../styles/style-guide'
import type {Props} from './user.render'

export default class Render extends Component<void, Props, void> {
  render () {
    let headerColor
    if (this.props.trackerState === proofNormal) {
      headerColor = this.props.currentlyFollowing ? globalColors.green : globalColors.blue
    } else {
      headerColor = globalColors.red
    }

    let actions
    if (this.props.trackerState === proofNormal) {
      if (this.props.currentlyFollowing) {
        actions = (
          <Box style={styleActionBox}>
            <FollowButton following onUnfollow={this.props.onUnfollow} style={styleFollowButton} />
          </Box>
        )
      } else {
        actions = (
          <Box style={styleActionBox}>
            <FollowButton following={false} onFollow={this.props.onFollow} style={styleFollowButton} />
          </Box>
        )
      }
    } else {
      actions = (
        <Box style={styleActionBox}>
          <Button type='Unfollow' label='Untrack' onClick={this.props.onUnfollow} />
          <Button type='Follow' label='Accept' onClick={this.props.onAcceptProofs} style={styleFollowButton} />
        </Box>
      )
    }

    return (
      <Box style={styleContainer}>
        <Box style={styleScroller} className='hide-scrollbar'>
          <Box style={{...styleHeader, backgroundColor: headerColor}} />
          <UserBio
            avatarSize={112}
            style={{marginTop: 39}}
            username={this.props.username}
            userInfo={this.props.userInfo}
            trackerState={this.props.trackerState}
            currentlyFollowing={this.props.currentlyFollowing}
          />
          <UserProofs
            style={{marginTop: globalMargins.small, marginLeft: globalMargins.medium, marginRight: globalMargins.medium}}
            username={this.props.username}
            proofs={this.props.proofs}
            currentlyFollowing={this.props.currentlyFollowing}
          />
        </Box>
        {actions}
      </Box>
    )
  }
}

const styleContainer = {
  ...globalStyles.flexBoxColumn,
  width: 320,
  height: '100%'
}

const styleScroller = {
  position: 'relative',
  flex: 1,
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingBottom: globalMargins.small
}

const styleHeader = {
  position: 'absolute',
  width: '100%',
  height: 96
}

const styleActionBox = {
  ...globalStyles.flexBoxRow,
  justifyContent: 'flex-end',
  padding: globalMargins.small,
  boxShadow: `0 0 5px ${globalColors.black_20}`,
  zIndex: 1
}

const styleFollowButton = {
  marginRight: 0
}
