// @flow

import React, {Component} from 'react'
import {globalStyles, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './user-card'
import Avatar from './avatar'

export default class UserCard extends Component<void, Props, void> {
  render () {
    const url = this.props.username ? `https://keybase.io/${this.props.username}` : null
    return (
      <div style={{...styles.container, ...this.props.style}}>
        <Avatar size={110} style={styles.avatar} onClick={this.props.onAvatarClicked} url={url}/>
        {this.props.children}
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
    backgroundColor: globalColorsDZ2.white
  },
  avatar: {
    marginTop: -110 / 2
  }
}
