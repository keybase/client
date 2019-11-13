import * as React from 'react'
import * as Kb from '../../../common-adapters'
import * as Styles from '../../../styles'
import {formatTimeForChat} from '../../../util/timestamp'

export type Props = {
  timestamp?: number
  username?: string
  teamname?: string
  children?: React.ReactNode
  style?: Object | null
  onClickAvatar?: () => void
}

const AVATAR_SIZE = 32

const UserNotice = ({timestamp, username, teamname, children, style, onClickAvatar}: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} className="WrapperMessage-author" style={style}>
    <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
      <Kb.Avatar
        size={32}
        {...(username ? {username} : {teamname})}
        skipBackground={true}
        onClick={onClickAvatar}
        style={styles.avatar}
      />
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true}>
        <Kb.ConnectedUsernames
          colorBroken={true}
          colorFollowing={true}
          colorYou={true}
          onUsernameClicked={onClickAvatar}
          type="BodySmallBold"
          usernames={[username ?? '']}
        />
        {/* {this.props.showCrowns && (this.props.authorIsOwner || this.props.authorIsAdmin) && (
          <Kb.WithTooltip tooltip={this.props.authorIsOwner ? 'Owner' : 'Admin'}>
            <Kb.Icon
              color={
                this.props.authorIsOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35
              }
              fontSize={10}
              type="iconfont-crown-owner"
            />
          </Kb.WithTooltip>
        )} */}
        {timestamp && (
          <Kb.Text type="BodyTiny" style={styles.timestamp}>
            {formatTimeForChat(timestamp)}
          </Kb.Text>
        )}
      </Kb.Box2>
    </Kb.Box2>
    <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.contentUnderAuthorContainer}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        isElectron: {
          marginLeft: Styles.globalMargins.small,
        },
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      centeredOrdinal: {
        backgroundColor: Styles.globalColors.yellowOrYellowAlt,
      },
      container: Styles.platformStyles({isMobile: {overflow: 'hidden'}}),
      containerJoinLeave: Styles.platformStyles({
        isMobile: {
          paddingLeft: Styles.globalMargins.tiny,
        },
      }),
      containerNoExploding: Styles.platformStyles({isMobile: {paddingRight: Styles.globalMargins.tiny}}),
      containerNoUsername: Styles.platformStyles({
        isMobile: {
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: 3,
        },
      }),
      contentUnderAuthorContainer: Styles.platformStyles({
        isElectron: {
          marginTop: -16,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.small + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
        isMobile: {
          marginTop: -12,
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
      ellipsis: {marginLeft: Styles.globalMargins.tiny},
      emojiRow: Styles.platformStyles({
        isElectron: {
          borderBottomLeftRadius: Styles.borderRadius,
          borderBottomRightRadius: Styles.borderRadius,
          bottom: -Styles.globalMargins.mediumLarge,
          height: Styles.globalMargins.mediumLarge,
          paddingBottom: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          zIndex: 2,
        },
      }),
      emojiRowBorder: Styles.platformStyles({
        isElectron: {
          borderBottom: `1px solid ${Styles.globalColors.black_10}`,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
          borderRight: `1px solid ${Styles.globalColors.black_10}`,
        },
      }),
      emojiRowLast: Styles.platformStyles({
        isElectron: {
          border: 'none',
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          borderTopLeftRadius: Styles.borderRadius,
          borderTopRightRadius: Styles.borderRadius,
          paddingBottom: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.tiny,
          top: -Styles.globalMargins.mediumLarge + 1, // compensation for the orange line
        },
      }),
      fail: {color: Styles.globalColors.redDark},
      failUnderline: {color: Styles.globalColors.redDark, textDecorationLine: 'underline'},
      innerContainer: {
        ...Styles.padding(Styles.globalMargins.tiny, Styles.globalMargins.small),
        borderRadius: Styles.globalMargins.xtiny,
        marginLeft: Styles.isMobile ? Styles.globalMargins.medium : Styles.globalMargins.xlarge,
        marginRight: Styles.isMobile ? Styles.globalMargins.medium : Styles.globalMargins.xlarge,
      },
      marginLeftTiny: {marginLeft: Styles.globalMargins.tiny},
      menuButtons: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flexShrink: 0,
          justifyContent: 'flex-end',
          overflow: 'hidden',
        },
        isElectron: {height: 16},
        isMobile: {height: 21},
      }),
      menuButtonsWithAuthor: {marginTop: -16},
      messagePopupContainer: {
        marginRight: Styles.globalMargins.small,
      },
      orangeLine: {
        // don't push down content due to orange line
        backgroundColor: Styles.globalColors.orange,
        flexShrink: 0,
        height: 1,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      orangeLineCompensationLeft: Styles.platformStyles({
        isMobile: {
          left: -Styles.globalMargins.mediumLarge, // compensate for containerNoUsername's padding
        },
      }),
      orangeLineCompensationRight: Styles.platformStyles({
        isMobile: {
          right: -Styles.globalMargins.tiny, // compensate for containerNoExploding's padding
        },
      }),
      send: Styles.platformStyles({
        common: {
          position: 'absolute',
        },
        isElectron: {
          pointerEvents: 'none',
          right: 8,
          top: 2,
        },
        isMobile: {
          right: 0,
          top: -8,
        },
      }),
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
      timestamp: Styles.platformStyles({
        common: {paddingLeft: Styles.globalMargins.xtiny},
        isElectron: {lineHeight: 19},
      }),
      timestampHighlighted: {
        color: Styles.globalColors.black_50OrBlack_40,
      },
      usernameCrown: Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
          position: 'relative',
          top: -2,
        },
        isMobile: {alignItems: 'center'},
      }),
      usernameHighlighted: {
        color: Styles.globalColors.blackOrBlack,
      },
    } as const)
)

export {SmallUserNotice}
export default UserNotice
