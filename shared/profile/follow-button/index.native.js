// @flow
import React, {Component} from 'react'
import type {Props} from '.'
import {WaitingButton} from '../../common-adapters'

class FollowButton extends Component<Props> {
  render() {
    const {following, onFollow, onUnfollow, waitingKey, style, ...otherProps} = this.props

    if (following) {
      return (
        <WaitingButton
          type="PrimaryGreenActive"
          label="Following"
          onClick={onUnfollow}
          style={style}
          waitingKey={waitingKey}
          {...otherProps}
        />
      )
    } else {
      return (
        <WaitingButton
          type="PrimaryGreen"
          label="Follow"
          onClick={onFollow}
          style={style}
          waitingKey={waitingKey}
          {...otherProps}
        />
      )
    }
  }
}

export default FollowButton
