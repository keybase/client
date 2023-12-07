import * as Kb from '@/common-adapters'
import type {Props} from '.'

const UserCard = (p: Props) => {
  const {
    avatarBackgroundStyle,
    avatarSize = 96,
    outerStyle,
    onAvatarClicked,
    username,
    style,
    children,
    lighterPlaceholders,
  } = p
  return (
    <Kb.Box style={Kb.Styles.collapseStyles([styles.container, outerStyle])}>
      <Kb.Box style={styles.avatar}>
        <Kb.Box
          style={Kb.Styles.collapseStyles([
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
      <Kb.Box style={Kb.Styles.collapseStyles([styles.inside, style])}>{children}</Kb.Box>
    </Kb.Box>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: 0,
  },
  avatarBackground: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: Kb.Styles.platformStyles({
    common: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'stretch',
      width: '100%',
    },
    isTablet: {
      maxWidth: 410,
    },
  }),
  inside: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    padding: 16,
    width: '100%',
  },
}))

export default UserCard
