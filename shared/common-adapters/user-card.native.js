// @flow
import Avatar from './avatar'
import React, {Component} from 'react'
import type {Props} from './user-card'
import Box from './box'
import {globalStyles, globalColors} from '../styles'

const avatarSize = 112

class UserCard extends Component<void, Props, void> {
  render () {
    const url = this.props.username ? `https://keybase.io/${this.props.username}` : null
    return (
      <Box style={{...styles.container, ...this.props.outerStyle}}>
        <Box style={styles.avatar}>
          <Box style={styles.avatarBackground} />
          <Avatar size={avatarSize} onClick={this.props.onAvatarClicked} url={url} />
        </Box>
        <Box style={{...styles.inside, ...this.props.style}}>
          {this.props.children}
        </Box>
      </Box>
    )
  }
}

const styles = {
  container: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'stretch',
  },
  inside: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    backgroundColor: globalColors.white,
    padding: 16,
  },
  avatar: {
    ...globalStyles.flexBoxColumn,
    marginTop: 0,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  avatarBackground: {
    backgroundColor: globalColors.white,
    position: 'absolute',
    height: avatarSize / 2,
    top: avatarSize / 2,
    left: 0,
    right: 0,
  },
}

export default UserCard
