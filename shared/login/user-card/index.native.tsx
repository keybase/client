import * as Kb from '@/common-adapters'
import type {Props} from '.'

const UserCard = (p: Props) => {
  const {avatarBackgroundStyle, avatarSize = 96, outerStyle, onAvatarClicked} = p
  const {username, style, children} = p
  return (
    <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.collapseStyles([styles.container, outerStyle])}>
      <Kb.Box2 direction="vertical" alignItems="center" alignSelf="stretch" style={styles.avatar}>
        <Kb.Box2
          direction="vertical"
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
        />
      </Kb.Box2>
      <Kb.Box2 direction="vertical" fullWidth={true} style={Kb.Styles.collapseStyles([styles.inside, style])}>{children}</Kb.Box2>
    </Kb.Box2>
  )
}

const styles = Kb.Styles.styleSheetCreate(() => ({
  avatar: {
    marginTop: 0,
  },
  avatarBackground: {
    left: 0,
    position: 'absolute',
    right: 0,
  },
  container: Kb.Styles.platformStyles({
    common: {
    },
    isTablet: {
      maxWidth: 410,
    },
  }),
  inside: {
    justifyContent: 'flex-start',
    padding: 16,
  },
}))

export default UserCard
