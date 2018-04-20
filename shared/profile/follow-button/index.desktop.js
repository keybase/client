// @flow
import React, {Component} from 'react'
import type {Props} from '.'
import {Button} from '../../common-adapters'

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
    const {following, onFollow, onUnfollow, style, waiting, ...otherProps} = this.props

    if (following) {
      return (
        <Button
          type={this.state.mouseOver ? 'PrimaryGreen' : 'PrimaryGreenActive'}
          label={this.state.mouseOver ? 'Unfollow' : 'Following'}
          onClick={onUnfollow}
          waiting={waiting}
          onMouseEnter={() => this.setState({mouseOver: true})}
          onMouseLeave={() => this.setState({mouseOver: false})}
          style={{...styleButton, ...style}}
          {...otherProps}
        />
      )
    } else {
      return (
        <Button
          type="PrimaryGreen"
          label="Follow"
          onClick={onFollow}
          waiting={waiting}
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
