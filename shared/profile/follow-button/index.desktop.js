// @flow
import React, {Component} from 'react'
import type {Props} from '.'
import {WaitingButton} from '../../common-adapters'

type State = {mouseOver: boolean}

class FollowButton extends Component<Props, State> {
  state: State

  constructor(props: Props) {
    super(props)

    this.state = {
      mouseOver: false,
    }
  }

  render() {
    const {following, onFollow, onUnfollow, style, waitingKey, ...otherProps} = this.props

    if (following) {
      return (
        <WaitingButton
          type={this.state.mouseOver ? 'PrimaryGreen' : 'PrimaryGreenActive'}
          label={this.state.mouseOver ? 'Unfollow' : 'Following'}
          onClick={onUnfollow}
          waitingKey={waitingKey}
          onMouseEnter={() => this.setState({mouseOver: true})}
          onMouseLeave={() => this.setState({mouseOver: false})}
          style={{...styleButton, ...style}}
          {...otherProps}
        />
      )
    } else {
      return (
        <WaitingButton
          type="PrimaryGreen"
          label="Follow"
          onClick={onFollow}
          waitingKey={waitingKey}
          style={{...styleButton, ...style}}
          {...otherProps}
        />
      )
    }
  }
}

const styleButton = {
  width: 125,
}

export default FollowButton
