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
    console.log('in avatar render')

    return (
      <View onClick={this.props.onClick}>
        <Icon style={{...avatarStyle(this.props.size - 2),
            top: 1,
            left: 1,
          }}
          type='placeholder-avatar'
        ></Icon>
      </View>
    )
  }
}

function avatarStyle (size: number): Object {
  return {
    width: size,
    height: size,
    borderRadius: size / 2,
    position: 'absolute'
  }
}
