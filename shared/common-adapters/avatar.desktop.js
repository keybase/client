// @flow
import * as shared from './avatar.shared'
import React, {Component} from 'react'
import type {Props} from './avatar'
import {globalStyles, globalColors} from '../styles/style-guide'
import {resolveImageAsURL} from '../../desktop/resolve-root'

const noAvatar = resolveImageAsURL('icons', 'icon-placeholder-avatar-112-x-112@2x.png')

type State = {
  avatarLoaded: boolean,
  errored: boolean,
}

class Avatar extends Component<void, Props, State> {
  state: State;

  constructor (props: Props) {
    super(props)
    this.state = {avatarLoaded: false, errored: false}
  }

  render () {
    const {size} = this.props
    const width = size
    const height = size
    const url = shared.createAvatarUrl(this.props) || noAvatar
    const avatarStyle = {width, height, borderRadius: size / 2, position: 'absolute'}

    const showNoAvatar = (!this.props.loadingColor && !this.state.avatarLoaded) ||
      (this.state.avatarLoaded && this.state.errored)
    const showLoadingColor = (this.props.loadingColor && !this.state.avatarLoaded) || this.props.forceLoading

    return (
      <div onClick={this.props.onClick} style={{...globalStyles.noSelect, position: 'relative', width, height, ...this.props.style}}>
        {showNoAvatar &&
          <img src={noAvatar} style={{...avatarStyle, display: 'block'}} />}
        {showLoadingColor && <div style={{...avatarStyle, backgroundColor: this.props.loadingColor}} />}
        <img
          src={url}
          style={{...avatarStyle,
            display: (!showNoAvatar && !showLoadingColor) ? 'block' : 'none',
            backgroundColor: globalColors.white,
          }}
          onError={() => this.setState({errored: true})}
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
    borderRadius: size / 2,
    top: padding,
    right: padding,
    bottom: padding,
    left: padding,
  }
}

export default Avatar
