import Avatar from './avatar'
import * as React from 'react'
import * as Styles from '../styles'

import {Props} from './user-card'

const Kb = {
  Avatar,
}

const avatarSize = 128

const UserCard = ({outerStyle, onAvatarClicked, username, style, children}: Props) => (
  <div style={Styles.collapseStyles([styles.container, outerStyle])}>
    <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
    <div style={Styles.collapseStyles([styles.inside, style])}>{children}</div>
  </div>
)

const styles = Styles.styleSheetCreate(() => ({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 430,
    width: 410,
  },
  inside: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Styles.globalColors.white,
    borderRadius: 4,
    marginTop: -avatarSize / 2,
    padding: 30,
    paddingTop: 30 + avatarSize / 2,
  },
}))

export default UserCard
