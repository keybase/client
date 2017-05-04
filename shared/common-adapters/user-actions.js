// @flow
import React from 'react'
import type {Props} from './user-actions'
import {Box, Button, FollowButton} from '../common-adapters'
import {globalMargins} from '../styles'
import {normal as proofNormal} from '../constants/tracker'

function UserActions ({trackerState, currentlyFollowing, style, onChat, onFollow, onUnfollow, onAcceptProofs}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <Box style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} style={{marginRight: globalMargins.xtiny}} />
          <Button type='Primary' label='Start a Chat' onClick={onChat} style={{marginRight: 0}} />
        </Box>
      )
    } else {
      return (
        <Box style={style}>
          <Button type='Unfollow' label='Unfollow' onClick={onUnfollow} style={{marginRight: globalMargins.xtiny}} />
          <Button type='Follow' label='Accept' onClick={onAcceptProofs} style={{marginRight: 0}} />
        </Box>
      )
    }
  } else {
    return (
      <Box style={style}>
        <FollowButton following={false} onFollow={onFollow} style={{marginRight: globalMargins.xtiny}} />
        <Button type='Primary' label='Start a Chat' onClick={onChat} style={{marginRight: 0}} />
      </Box>
    )
  }
}

export default UserActions
