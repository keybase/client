import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import {getAddedUsernames} from '../system-users-added-to-conv'
import {formatTimeForChat} from '../../../../util/timestamp'
type Props = {
  author: string
  authorIsYou: boolean
  channelname: string
  isAdHoc: boolean
  isBigTeam: boolean
  joiners: Array<string>
  leavers: Array<string>
  onAuthorClick: (username: string) => void
  onManageChannels: () => void
  onManageNotifications: () => void
  teamname: string
  timestamp: number
}

const textType = 'BodySmallSemiboldPrimaryLink'

const Joined = (props: Props) => {
  if (props.joiners.length + props.leavers.length == 1) {
    return <JoinedUserNotice {...props} />
  }

  const joinMsg =
    props.joiners.length == 1 ? (
      <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start" style={styles.singleEvent}>
        <AuthorAndAvatar {...props} username={props.joiners[0]} />
        <Kb.Box2
          direction="vertical"
          alignSelf="flex-start"
          style={Styles.collapseStyles([
            styles.contentUnderAuthorContainer,
            props.leavers.length > 0 && styles.joinerPadding,
          ])}
        >
          <JoinedUserNotice {...props} joiners={props.joiners} leavers={[]} />
        </Kb.Box2>
      </Kb.Box2>
    ) : props.joiners.length > 1 ? (
      <MultiUserJoinedNotice {...props} joiners={props.joiners} leavers={[]} />
    ) : null
  const leaveMsg =
    props.leavers.length == 1 ? (
      <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start" style={styles.singleEvent}>
        <AuthorAndAvatar {...props} username={props.leavers[0]} />
        <Kb.Box2 direction="vertical" alignSelf="flex-start" style={styles.contentUnderAuthorContainer}>
          <JoinedUserNotice {...props} joiners={[]} leavers={props.leavers} />
        </Kb.Box2>
      </Kb.Box2>
    ) : props.leavers.length > 1 ? (
      <MultiUserJoinedNotice {...props} joiners={[]} leavers={props.leavers} />
    ) : null

  return (
    <Kb.Box2 direction="vertical" style={styles.container} fullWidth={true} alignSelf="flex-start">
      {joinMsg}
      {leaveMsg}
    </Kb.Box2>
  )
}

const MultiUserJoinedNotice = (props: Props) => (
  <Kb.Box2 direction="vertical" fullWidth={true} alignSelf="flex-start">
    <UserNotice noUsername={true}>
      {!!props.timestamp && (
        <Kb.Text type="BodyTiny" style={styles.timestamp}>
          {formatTimeForChat(props.timestamp)}
        </Kb.Text>
      )}
      <Kb.Text type="BodySmall" style={{paddingBottom: Styles.globalMargins.xxtiny}}>
        {props.joiners.length > 0 ? getAddedUsernames(props.joiners) : getAddedUsernames(props.leavers)}
        {` ${props.leavers.length > props.joiners.length ? 'left' : 'joined'} ${
          props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`
        }`}
      </Kb.Text>
      <Kb.Box2 direction="horizontal" alignSelf="flex-start" style={styles.avatarLine}>
        <Kb.AvatarLine
          usernames={props.joiners.length > 0 ? props.joiners : props.leavers}
          maxShown={3}
          size={32}
          layout="horizontal"
          alignSelf="flex-start"
        />
      </Kb.Box2>
    </UserNotice>
  </Kb.Box2>
)

const JoinedUserNotice = (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      {props.authorIsYou ? 'You ' : ''}
      {props.leavers.length > props.joiners.length ? 'left' : 'joined'}{' '}
      {props.isBigTeam ? `#${props.channelname}` : props.isAdHoc ? 'the conversation' : 'the team'}.
    </Kb.Text>
    {props.authorIsYou && props.isBigTeam && (
      <Kb.Text type="BodySmall">
        <Kb.Text onClick={props.onManageNotifications} type={textType}>
          Manage your notifications
        </Kb.Text>
        {` or `}
        <Kb.Text onClick={props.onManageChannels} type={textType}>
          browse other channels
        </Kb.Text>
        .
      </Kb.Text>
    )}
  </UserNotice>
)

const AuthorAndAvatar = (props: {
  username: string
  timestamp: number
  authorIsYou: boolean
  onAuthorClick: (username: string) => void
}) => (
  <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny" fullWidth={true}>
    <Kb.Avatar
      size={32}
      username={props.username}
      skipBackground={true}
      onClick={() => props.onAuthorClick(props.username)}
      style={styles.avatar}
    />
    <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.usernameCrown}>
      <Kb.ConnectedUsernames
        colorBroken={true}
        colorFollowing={true}
        colorYou={true}
        onUsernameClicked="profile"
        style={Styles.collapseStyles([props.authorIsYou && styles.usernameHighlighted])}
        type="BodySmallBold"
        usernames={props.username}
      />
      <Kb.Text type="BodyTiny" style={styles.timestamp}>
        {formatTimeForChat(props.timestamp)}
      </Kb.Text>
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
      avatarLine: Styles.platformStyles({
        isElectron: {
          marginLeft: -2,
        },
        isMobile: {
          marginLeft: -Styles.globalMargins.xsmall,
        },
      }),
      container: Styles.platformStyles({
        isElectron: {
          paddingTop: Styles.globalMargins.xtiny,
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
            Styles.globalMargins.small + Styles.globalMargins.mediumLarge, // left margin // avatar,
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
      joinerPadding: Styles.platformStyles({
        isElectron: {
          paddingBottom: Styles.globalMargins.xsmall,
        },
        isMobile: {
          paddingBottom: Styles.globalMargins.xtiny,
        },
      }),
      singleEvent: Styles.platformStyles({
        isMobile: {
          marginLeft: -(
            (Styles.globalMargins.small + Styles.globalMargins.mediumLarge) // left margin
          ), // avatar
        },
      }),
      timestamp: Styles.platformStyles({
        isElectron: {lineHeight: 19},
      }),
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

export default Joined
