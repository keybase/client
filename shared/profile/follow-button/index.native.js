// @flow
import React, {Component} from 'react'
import type {Props} from '.'
import Button from '../../common-adapters/button'

class FollowButton extends Component<Props> {
  render() {
    const {following, onFollow, onUnfollow, style, waiting, ...otherProps} = this.props

    if (following) {
      return (
        <Button
          type="PrimaryGreenActive"
          label="Following"
          onClick={onUnfollow}
          style={style}
          waiting={waiting}
          {...otherProps}
        />
      )
    } else {
      return (
        <Button
          type="PrimaryGreen"
          label="Follow"
          onClick={onFollow}
          style={style}
          waiting={waiting}
          {...otherProps}
        />
      )
    }
  }
}

export default FollowButton
