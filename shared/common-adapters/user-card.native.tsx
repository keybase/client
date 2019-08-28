import * as React from 'react'
import * as Styles from '../styles'
import Avatar from './avatar'
import Box from './box'

import {Props} from './user-card'

const Kb = {
  Avatar,
  Box,
}

const avatarSize = 96

const UserCard = ({outerStyle, onAvatarClicked, username, style, children, contrasting}: Props) => (
  <Kb.Box style={Styles.collapseStyles([styles.container, outerStyle])}>
    <Kb.Box style={styles.avatar}>
      <Kb.Box style={styles.avatarBackground} />
      <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} contrasting={contrasting} />
    </Kb.Box>
    <Kb.Box style={Styles.collapseStyles([styles.inside, style])}>{children}</Kb.Box>
  </Kb.Box>
)

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 0,
  },
  avatarBackground: {
    backgroundColor: Styles.globalColors.white,
    height: avatarSize / 2,
    left: 0,
    position: 'absolute',
    right: 0,
    top: avatarSize / 2,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
  },
  inside: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    backgroundColor: Styles.globalColors.white,
    justifyContent: 'flex-start',
    padding: 16,
  },
}))

export default UserCard
