// @flow
import Avatar from './avatar'
import React, {Component} from 'react'
import type {Props} from './user-card'
import {globalStyles, globalColors} from '../styles'

const avatarSize = 112

class UserCard extends Component<void, Props, void> {
  render () {
    return (
      <div style={{...styles.container, ...this.props.outerStyle}}>
        <Avatar size={avatarSize} onClick={this.props.onAvatarClicked} username={this.props.username} />
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
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: globalColors.white,
    borderRadius: 4,
    marginTop: -avatarSize / 2,
    padding: 30,
    paddingTop: 30 + avatarSize / 2,
  },
}

export default UserCard
