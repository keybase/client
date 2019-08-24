import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'

export type Props = {
  bgColor: string
  username?: string
  teamname?: string
  children?: React.ReactNode
  style?: Object | null
  onClickAvatar?: () => void
}

const AVATAR_SIZE = 32

const UserNotice = ({bgColor, username, teamname, children, style, onClickAvatar}: Props) => (
  <Kb.Box2
    alignItems="center"
    direction="vertical"
    style={Styles.collapseStyles([styles.outerContainer, style])}
  >
    {!!(username || teamname) && (
      <Kb.ClickableBox style={styles.avatarContainer} onClick={onClickAvatar}>
        <Kb.Avatar size={AVATAR_SIZE} {...(username ? {username} : {teamname})} style={styles.avatar} />
      </Kb.ClickableBox>
    )}
    <Kb.Box2
      alignItems="center"
      alignSelf="stretch"
      direction="vertical"
      style={Styles.collapseStyles([
        styles.innerContainer,
        {backgroundColor: bgColor},
        !!(username || teamname) && {paddingTop: Styles.globalMargins.small},
      ])}
    >
      {children}
    </Kb.Box2>
  </Kb.Box2>
)

export type SmallProps = {
  avatarUsername: string
  bottomLine: React.ElementType
  onAvatarClicked: () => void
  title?: string
  topLine: React.ElementType
}

const SmallUserNotice = (props: SmallProps) => (
  <Kb.Box2 alignItems="flex-start" direction="horizontal" style={styles.smallNotice}>
    <Kb.Avatar
      onClick={props.onAvatarClicked}
      size={AVATAR_SIZE}
      username={props.avatarUsername}
      style={styles.smallNoticeAvatar}
    />
    <Kb.Box2 direction="vertical">
      {props.topLine}
      {props.bottomLine}
    </Kb.Box2>
  </Kb.Box2>
)

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    isElectron: {
      ...Styles.desktopStyles.clickable,
    },
  }),
  avatarContainer: {
    ...Styles.globalStyles.flexBoxColumn,
    alignItems: 'center',
    height: AVATAR_SIZE,
    position: 'relative',
    top: AVATAR_SIZE / 2,
    zIndex: 10,
  },
  innerContainer: {
    ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
    borderRadius: Styles.globalMargins.xtiny,
    marginLeft: Styles.isMobile ? Styles.globalMargins.medium : Styles.globalMargins.xlarge,
    marginRight: Styles.isMobile ? Styles.globalMargins.medium : Styles.globalMargins.xlarge,
  },
  outerContainer: {
    flex: 1,
    marginBottom: Styles.globalMargins.tiny,
  },
  smallNotice: Styles.platformStyles({
    common: {
      justifyContent: 'flex-start',
      marginBottom: Styles.globalMargins.xtiny,
      marginRight: Styles.globalMargins.medium,
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.small,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),
  smallNoticeAvatar: {
    marginRight: Styles.globalMargins.tiny,
  },
})

export {SmallUserNotice}
export default UserNotice
