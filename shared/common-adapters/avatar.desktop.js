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
    const {size} = this.props
    const width = size
    const height = size
    const url = this._createUrl()
    const avatarStyle = {width, height, borderRadius: size / 2, position: 'absolute'}

    return (
      <div onClick={this.props.onClick} style={{...globalStyles.noSelect, position: 'relative', width, height, ...this.props.style}}>
        {!this.state.avatarLoaded &&
          <div
            style={{...avatarStyle,
              backgroundImage: `url('${noAvatar}')`,
              backgroundSize: 'cover',
            }} />}
        <img
          src={url}
          style={{...avatarStyle,
            display: this.state.avatarLoaded ? 'block' : 'none',
            backgroundColor: globalColors.white,
          }}
          onLoad={() => this.setState({avatarLoaded: true})} />
        <div>
        {size > 16 && (this.props.following || this.props.followsYou) &&
          <div>
            {this.props.followsYou && <div style={{...followTop(size, globalColors.green)}}> <div style={{...followInner(size, globalColors.white)}} /></div>}
            <div style={{...followBottom(size, this.props.following ? globalColors.green : globalColors.grey)}} />
          </div>
        }
        </div>
      </div>
    )
  }
}

const followBadgeCommon = (size, color) => ({
  position: 'absolute',
  width: Math.round(size / 60 * 12),
  height: Math.round(size / 60 * 12),
  background: color,
  borderRadius: '50%',
  border: `${Math.round(size / 60 * 2)}px solid ${globalColors.white}`,
})

const followTop = (size, color) => ({
  ...followBadgeCommon(size, color),
  bottom: Math.round(size / 60 * 5),
  right: 0,
})

const followBottom = (size, color) => ({
  ...followBadgeCommon(size, color),
  bottom: 0,
  right: Math.round(size / 60 * 5),
})

const followInner = (size, color) => {
  const padding = Math.round(size / 60 * 12 / 7)
  return {
    position: 'absolute',
    background: color,
    borderRadius: '50%',
    top: padding,
    right: padding,
    bottom: padding,
    left: padding,
  }
}

