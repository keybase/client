// @flow
import React, {Component} from 'react'
import {Button} from './'
import type {Props} from './follow-button'

type State = {mouseOver: boolean}

export default class FollowButton extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)

    this.state = {
      mouseOver: false,
    }
  }

  render () {
    const {following, onFollow, onUnfollow, style, ...otherProps} = this.props

    if (following) {
      return <Button
        type={this.state.mouseOver ? 'Unfollow' : 'Following'}
        label={this.state.mouseOver ? 'Untrack' : 'Tracking'}
        onClick={onUnfollow}
        onMouseEnter={() => this.setState({mouseOver: true})}
        onMouseLeave={() => this.setState({mouseOver: false})}
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
