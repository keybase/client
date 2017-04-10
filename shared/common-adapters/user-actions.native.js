// @flow
import React from 'react'
import type {Props} from './user-actions'
import Box from './box'
import Button from './button'
import FollowButton from './follow-button'
import {globalMargins} from '../styles'
import {normal as proofNormal} from '../constants/tracker'

function UserActions ({trackerState, currentlyFollowing, style, onFollow, onUnfollow, onAcceptProofs}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <Box style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} style={{marginRight: 0}} />
        </Box>
      )
    } else {
      return (
        <Box style={style}>
          <Button type='Unfollow' label='Unfollow' onClick={onUnfollow} style={{marginRight: globalMargins.tiny, width: undefined}} />
          <Button type='Follow' label='Accept' onClick={onAcceptProofs} style={{marginRight: 0, width: undefined}} />
        </Box>
      )
    }
  } else {
    return (
      <Box style={style}>
        <FollowButton following={false} onFollow={onFollow} style={{marginRight: 0}} />
      </Box>
    )
  }
}

export default UserActions
