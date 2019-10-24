import * as React from 'react'
import * as Styles from '../styles'
import Avatar from './avatar'
import Box from './box'

import {Props} from './user-card'

const Kb = {
  Avatar,
  Box,
}

const UserCard = ({
  avatarBackgroundStyle,
  avatarSize,
  outerStyle,
  onAvatarClicked,
  username,
  style,
  children,
  lighterPlaceholders,
}: Props) => {
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
            avatarBackgroundStyle,
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

UserCard.defaultProps = {
  avatarSize: 96,
}

const styles = Styles.styleSheetCreate(() => ({
  avatar: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 0,
  },
  avatarBackground: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    width: '100%',
  },
  inside: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 16,
    width: '100%',
  },
}))

export default UserCard
