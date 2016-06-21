// @flow

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './user-card'
import Avatar from './avatar'

const avatarSize = 112

export default class UserCard extends Component<void, Props, void> {
  render () {
    const url = this.props.username ? `https://keybase.io/${this.props.username}/picture` : null
    return (
      <div style={{...styles.container, ...this.props.outerStyle}}>
        <Avatar size={avatarSize} onClick={this.props.onAvatarClicked} url={url} />
        <div style={{...styles.inside, ...this.props.style}}>
          {this.props.children}
        </div>
      </div>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    width: 410,
    height: 430,
  },
  inside: {
    ...globalStyles.flexBoxColumn,
    backgroundColor: globalColors.white,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: -avatarSize / 2,
    padding: 30,
    paddingTop: 30 + avatarSize / 2,
  },
}
