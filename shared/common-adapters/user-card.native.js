// @flow

import React, {Component} from 'react-native'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './user-card'
import Avatar from './avatar'
import {Box} from '../common-adapters'
const avatarSize = 110

export default class UserCard extends Component<void, Props, void> {
  render () {
    const url = this.props.username ? `https://keybase.io/${this.props.username}` : null
    return (
      <Box style={{...styles.container, ...this.props.outerStyle}}>
        <Box style={styles.avatar}>
          <Avatar size={avatarSize} onClick={this.props.onAvatarClicked} url={url}/>
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
    backgroundColor: globalColors.white,
    marginTop: 37
  },
  inside: {
    ...globalStyles.flexBoxColumn,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    padding: 16
  },
  avatar: {
    ...globalStyles.flexBoxRow,
    marginTop: -avatarSize / 2,
    justifyContent: 'center',
    alignSelf: 'stretch'
  }
}
