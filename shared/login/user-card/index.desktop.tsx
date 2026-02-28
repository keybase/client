import * as Kb from '@/common-adapters'
import type {Props} from '.'

const UserCard = (p: Props) => {
  const {avatarSize = 128, outerStyle, onAvatarClicked, username, style, children, lighterPlaceholders} = p
  return (
    <div style={Kb.Styles.collapseStyles([styles.container, outerStyle]) as React.CSSProperties}>
      <Kb.Avatar
        size={avatarSize}
        onClick={onAvatarClicked}
        username={username}
        lighterPlaceholders={lighterPlaceholders}
      />
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

const styles = Kb.Styles.styleSheetCreate(() => ({
  container: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: 430,
    width: 410,
  },
  inside: {
    ...Kb.Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: Kb.Styles.globalColors.white,
    borderRadius: 4,
    padding: 30,
  },
}))

export default UserCard
