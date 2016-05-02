// @flow

import React, {Component} from 'react'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './user-card'
import Avatar from './avatar'

const avatarSize = 110

export default class UserCard extends Component<void, Props, void> {
  render () {
    const url = this.props.username ? `https://keybase.io/${this.props.username}/picture` : null
    return (
      <div style={{...styles.container, ...this.props.outerStyle}}>
        <Avatar size={avatarSize} style={styles.avatar} onClick={this.props.onAvatarClicked} url={url} />
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
    height: 375,
    backgroundColor: globalColors.white,
    position: 'relative'
  },
  inside: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    marginTop: avatarSize / 2,
    padding: 30,
    width: '100%',
    height: '100%'
  },
  avatar: {
    position: 'absolute',
    top: -avatarSize / 2,
    left: 0,
    right: 0,
    marginLeft: 'auto',
    marginRight: 'auto'
  }
}
