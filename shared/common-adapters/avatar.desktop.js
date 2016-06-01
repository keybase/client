// @flow

import React, {Component} from 'react'
import {resolveImageAsURL} from '../../desktop/resolve-root'
import {globalColors} from '../styles/style-guide'
import type {Props} from './avatar'
import * as shared from './avatar.shared'

const noAvatar = resolveImageAsURL('icons', 'placeholder-avatar@2x.png')

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
    const width = this.props.size
    const height = this.props.size
    const url = __SCREENSHOT__ ? noAvatar : shared.createUrl(this.props)

    return (
      <div onClick={this.props.onClick} style={{position: 'relative', width, height, ...this.props.style}}>
        <div
          style={{...avatarStyle(this.props.size - 2),
            top: 1,
            left: 1,
            backgroundImage: `url('${noAvatar}')`,
            backgroundSize: 'cover'
          }} />
        <img
          src={url}
          style={{...avatarStyle(this.props.size),
            display: this.state.avatarLoaded ? 'block' : 'none',
            backgroundColor: globalColors.white
          }}
          onLoad={() => this.setState({avatarLoaded: true})} />
      </div>
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

