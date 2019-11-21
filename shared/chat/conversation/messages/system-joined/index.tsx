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
  isBigTeam: boolean
  joiners: Array<string>
  leavers: Array<string>
  onManageChannels: () => void
  onManageNotifications: () => void
  teamname: string
  timestamp: number
}

const textType = 'BodySmallSemiboldPrimaryLink'

const Joined = (props: Props) =>
  props.joiners.length + props.leavers.length < 2 ? (
    <JoinedUserNotice {...props} />
  ) : (
    <MultiUserJoinedNotice {...props} />
  )

const MultiUserJoinedNotice = (props: Props) => (
  <Kb.Box2
    direction="vertical"
    alignSelf="flex-start"
    style={{marginLeft: Styles.globalMargins.small, paddingTop: Styles.globalMargins.xtiny}}
  >
    {props.timestamp && (
      <Kb.Text type="BodyTiny" style={styles.timestamp}>
        {formatTimeForChat(props.timestamp)}
      </Kb.Text>
    )}
    <Kb.Text type="BodySmall" style={{paddingBottom: Styles.globalMargins.xxtiny}}>
      {props.joiners.length > 0 && getAddedUsernames(props.joiners)}
      {props.joiners.length > 0 &&
        ` joined ${props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`}`}
    </Kb.Text>
    <Kb.AvatarLine
      usernames={props.joiners}
      maxShown={4}
      size={32}
      layout="horizontal"
      alignSelf="flex-start"
    />
  </Kb.Box2>
)

const JoinedUserNotice = (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      {props.authorIsYou ? 'You ' : ''}
      {props.leavers.length > props.joiners.length ? 'left' : 'joined'}{' '}
      {props.isBigTeam ? `#${props.channelname}` : 'the team'}.
    </Kb.Text>
    {props.authorIsYou && props.isBigTeam && (
      <Kb.Text type="BodySmall">
        <Kb.Text onClick={props.onManageNotifications} type={textType} center={true}>
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      timestamp: Styles.platformStyles({
        isElectron: {lineHeight: 19},
      }),
    } as const)
)

export default Joined
