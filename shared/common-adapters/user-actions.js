// @flow
import * as React from 'react'
import type {Props} from './user-actions'
import {Button, FollowButton, ButtonBar} from '../common-adapters'
import {normal as proofNormal} from '../constants/tracker'

function UserActions({
  trackerState,
  currentlyFollowing,
  style,
  onChat,
  onFollow,
  onUnfollow,
  onAcceptProofs,
  waiting,
}: Props) {
  if (currentlyFollowing) {
    if (trackerState === proofNormal) {
      return (
        <ButtonBar style={style}>
          <FollowButton following={true} onUnfollow={onUnfollow} waiting={waiting} />
          <Button type="Primary" label="Start a Chat" onClick={onChat} style={{marginRight: 0}} />
        </ButtonBar>
      )
    } else {
      return (
        <ButtonBar style={style}>
          <Button type="Secondary" label="Unfollow" onClick={onUnfollow} waiting={waiting} />
          <Button type="PrimaryGreen" label="Accept" onClick={onAcceptProofs} style={{marginRight: 0}} />
        </ButtonBar>
      )
    }
  } else {
    return (
      <ButtonBar style={style}>
        <FollowButton following={false} onFollow={onFollow} waiting={waiting} />
        <Button type="Primary" label="Start a Chat" onClick={onChat} style={{marginRight: 0}} />
      </ButtonBar>
    )
  }
}

export default UserActions
