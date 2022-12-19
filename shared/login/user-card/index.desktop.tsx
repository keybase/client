import * as Kb from '../../common-adapters'
import * as Styles from '../../styles'
import type {Props} from '.'

const UserCard = ({
  avatarSize,
  outerStyle,
  onAvatarClicked,
  username,
  style,
  children,
  lighterPlaceholders,
}: Props) => {
  return (
    <div style={Styles.collapseStyles([styles.container, outerStyle])}>
      <Kb.Avatar
        size={avatarSize}
        onClick={onAvatarClicked}
        username={username}
        lighterPlaceholders={lighterPlaceholders}
      />
      <div
        style={Styles.collapseStyles([
          styles.inside,
          {
            marginTop: -avatarSize / 2,
            paddingTop: 30 + avatarSize / 2,
          },
          style,
        ])}
      >
        {children}
      </div>
    </div>
  )
}

UserCard.defaultProps = {
  avatarSize: 128,
}

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
    padding: 30,
  },
}))

export default UserCard
