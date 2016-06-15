// @flow
import React from 'react'
import {normal as proofNormal} from '../constants/tracker'
import {Box, Button, FollowButton} from '../common-adapters'
import {globalColors, globalMargins} from '../styles/style-guide'
import type {SimpleProofState} from '../constants/tracker'

export function userHeaderColor (trackerState: SimpleProofState, currentlyFollowing: boolean) {
  if (trackerState === proofNormal) {
    return currentlyFollowing ? globalColors.green : globalColors.blue
  } else {
    return globalColors.red
  }
}

export function UserActions ({trackerState, currentlyFollowing, style, onFollow, onUnfollow, onAcceptProofs}: {
  trackerState: SimpleProofState,
  currentlyFollowing: boolean,
  style: Object,
  onFollow: () => void,
  onUnfollow: () => void,
  onAcceptProofs: () => void
}) {
  if (trackerState === proofNormal) {
    if (currentlyFollowing) {
      return (
        <Box style={style}>
          <FollowButton following onUnfollow={onUnfollow} style={{marginRight: 0}} />
        </Box>
      )
    } else {
      return (
        <Box style={style}>
          <FollowButton following={false} onFollow={onFollow} style={{marginRight: 0}} />
        </Box>
      )
    }
  } else {
    return (
      <Box style={style}>
        <Button type='Unfollow' label='Untrack' onClick={onUnfollow} style={{marginRight: globalMargins.xtiny}} />
        <Button type='Follow' label='Accept' onClick={onAcceptProofs} style={{marginRight: 0}} />
      </Box>
    )
  }
}
