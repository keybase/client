// @flow
import React, {Component} from 'react'
import type {Props} from './follow-button'
import {Button} from './'

class FollowButton extends Component<void, Props, void> {
  render () {
    const {following, onFollow, onUnfollow, style, ...otherProps} = this.props

    if (following) {
      return <Button
        type='Following'
        label='Following'
        onClick={onUnfollow}
        style={{...styleButton, ...style}}
        {...otherProps}
      />
    } else {
      return <Button
        type='Follow'
        label='Follow'
        onClick={onFollow}
        style={{...styleButton, ...style}}
        {...otherProps}
      />
    }
  }
}

const styleButton = {
  width: 140,
}

export default FollowButton
