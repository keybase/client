// @flow
import React, {Component} from 'react'
import type {Props} from './follow-button'
import Button from './button'

class FollowButton extends Component<void, Props, void> {
  render() {
    const {following, onFollow, onUnfollow, style, waiting, ...otherProps} = this.props

    if (following) {
      return <Button type="Following" label="Following" onClick={onUnfollow} style={style} disabled={waiting} {...otherProps} />
    } else {
      return <Button type="Follow" label="Follow" onClick={onFollow} style={style} disabled={waiting} {...otherProps} />
    }
  }
}

export default FollowButton
