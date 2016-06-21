// @flow
import React, {Component} from 'react'
import {Button} from './'
import type {Props} from './follow-button'

export default class FollowButton extends Component<void, Props, void> {
  render () {
    const {following, onFollow, onUnfollow, style, ...otherProps} = this.props

    if (following) {
      return <Button
        type='Following'
        label='Tracking'
        onClick={onUnfollow}
        style={{...styleButton, ...style}}
        {...otherProps}
      />
    } else {
      return <Button
        type='Follow'
        label='Track'
        onClick={onFollow}
        style={{...styleButton, ...style}}
        {...otherProps}
      />
    }
  }
}

const styleButton = {
  width: 125,
}
