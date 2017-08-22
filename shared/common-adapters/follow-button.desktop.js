// @flow
import React, {Component} from 'react'
import type {Props} from './follow-button'
import {Button} from './'

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
          type={this.state.mouseOver ? 'Unfollow' : 'Following'}
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
          type="Follow"
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
