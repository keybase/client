// @flow

import React, {Component} from 'react'
import {globalColors} from '../styles/style-guide'
import type {Props} from './avatar'
import {View} from 'react-native'
import {Icon} from '../common-adapters'

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
      <View style={{height: this.props.size, ...this.props.style}} onClick={this.props.onClick}>
        <Icon style={{...avatarStyle(this.props.size - 2)}}
          type='placeholder-avatar' />
      </View>
    )
  }
}

function avatarStyle (size: number): Object {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    alignSelf: 'center'
  }
}
