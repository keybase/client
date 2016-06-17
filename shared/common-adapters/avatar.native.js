// @flow

import React, {Component} from 'react'
import type {Props} from './avatar'
import {Box, Icon} from '../common-adapters'

export default class Avatar extends Component {
  props: Props;

  state: {
    avatarLoaded: boolean
  };

  constructor (props: Props) {
    super(props)
    this.state = {avatarLoaded: false}
  }

  render () {
    return (
      <Box style={{justifyContent: 'flex-end', ...this.props.style}} onClick={this.props.onClick}>
        <Icon style={{...avatarStyle(this.props.size - 2)}}
          type='placeholder-avatar' />
      </Box>
    )
  }
}

function avatarStyle (size: number): Object {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignSelf: 'center',
  }
}
