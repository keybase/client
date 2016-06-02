// @flow

import React, {Component} from 'react'
import {resolveImageAsURL} from '../../desktop/resolve-root'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './avatar'

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

  _createUrl (): ?string {
    if (__SCREENSHOT__) {
      return noAvatar
    } else if (this.props.url) {
      return this.props.url
    } else if (this.props.username) {
      return `https://keybase.io/${this.props.username}/picture`
    }

    return null
  }

  render () {
    const width = this.props.size
    const height = this.props.size
    const url = this._createUrl()
    const avatarStyle = {width, height, borderRadius: this.props.size / 2, position: 'absolute'}

    return (
      <div onClick={this.props.onClick} style={{...globalStyles.noSelect, position: 'relative', width, height, ...this.props.style}}>
        {!this.state.avatarLoaded &&
          <div
            style={{...avatarStyle,
              backgroundImage: `url('${noAvatar}')`,
              backgroundSize: 'cover'
            }} />}
        <img
          src={url}
          style={{...avatarStyle,
            display: this.state.avatarLoaded ? 'block' : 'none',
            backgroundColor: globalColors.white
          }}
          onLoad={() => this.setState({avatarLoaded: true})} />
      </div>
    )
  }
}

