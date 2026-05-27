import type * as React from 'react'
import * as Kb from '@/common-adapters'

type Props = {
  avatarSize?: 128 | 96 | 64 | 48 | 32 | 24 | 16
  avatarBackgroundStyle?: Kb.Styles.StylesCrossPlatform
  onAvatarClicked?: () => void
  outerStyle?: Kb.Styles.StylesCrossPlatform
  style?: Kb.Styles.StylesCrossPlatform
  username?: string
  children?: React.ReactNode
}

const UserCard = (p: Props) => {
  const {outerStyle, onAvatarClicked, username, style, children} = p

  if (!isMobile) {
    const {avatarSize = 128} = p
    return (
      <div style={Kb.Styles.collapseStyles([styles.container, outerStyle]) as React.CSSProperties}>
        <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
        <div
          style={
            Kb.Styles.collapseStyles([
              styles.inside,
              {
                marginTop: -avatarSize / 2,
                paddingTop: 30 + avatarSize / 2,
              },
              style,
            ]) as React.CSSProperties
          }
        >
          {children}
        </div>
      </div>
    )
  }

  const {avatarBackgroundStyle, avatarSize = 96} = p
  return (
    <Kb.Box2
      direction="vertical"
      fullWidth={true}
      style={Kb.Styles.collapseStyles([styles.container, outerStyle])}
    >
      <Kb.Box2 direction="vertical" alignItems="center" alignSelf="stretch" style={styles.avatar}>
        <Kb.Box2
          direction="vertical"
          style={Kb.Styles.collapseStyles([
            styles.avatarBackground,
            {height: avatarSize / 2, top: avatarSize / 2},
            avatarBackgroundStyle,
          ])}
        />
        <Kb.Avatar size={avatarSize} onClick={onAvatarClicked} username={username} />
      </Kb.Box2>
      <Kb.Box2
        direction="vertical"
        fullWidth={true}
        style={Kb.Styles.collapseStyles([styles.inside, style])}
      >
        {children}
      </Kb.Box2>
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
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      height: 430,
      width: 410,
    },
    isTablet: {
      maxWidth: 410,
    },
  }),
  inside: Kb.Styles.platformStyles({
    isElectron: {
      ...Kb.Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: Kb.Styles.globalColors.white,
      borderRadius: Kb.Styles.borderRadius,
      padding: 30,
    },
    isMobile: {
      justifyContent: 'flex-start',
      padding: 16,
    },
  }),
}))

export default UserCard
