import * as React from 'react'
import * as Styles from '../styles'
import Avatar from './avatar'
import Box from './box'

import {Props} from './user-card'

const Kb = {
  Avatar,
  Box,
}

const defaultAvatarSize = 96

const UserCard = ({
  avatarSize,
  outerStyle,
  onAvatarClicked,
  username,
  style,
  children,
  lighterPlaceholders,
}: Props) => {
  if (!avatarSize) {
    avatarSize = defaultAvatarSize
  }

  return (
    <Kb.Box style={Styles.collapseStyles([styles.container, outerStyle])}>
      <Kb.Box style={styles.avatar}>
        <Kb.Box
          style={Styles.collapseStyles([
            styles.avatarBackground,
            {
              height: avatarSize / 2,
              top: avatarSize / 2,
            },
          ])}
        />
        <Kb.Avatar
          size={avatarSize}
          onClick={onAvatarClicked}
          username={username}
          lighterPlaceholders={lighterPlaceholders}
        />
      </Kb.Box>
      <Kb.Box style={Styles.collapseStyles([styles.inside, style])}>{children}</Kb.Box>
    </Kb.Box>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 0,
  },
  avatarBackground: {
    backgroundColor: Styles.globalColors.white,
    left: 0,
    position: 'absolute',
    right: 0,
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
