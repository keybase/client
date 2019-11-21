import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'
import {formatTimeForChat} from '../../../../util/timestamp'
import {getAddedUsernames} from '../system-users-added-to-conv'

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
  // Bring more attention to the current user joining
  props.authorIsYou ? (
    <JoinedUserNotice {...props} />
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodyTiny">{formatTimeForChat(props.timestamp)}</Kb.Text>
      <Kb.Text type="BodySmall">
        {props.joiners.length > 0 && getAddedUsernames(props.joiners)}
        {props.joiners.length > 0 &&
          ` joined ${props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`}`}
      </Kb.Text>
    </Kb.Box2>
  )

const JoinedUserNotice = (props: Props) => (
  <UserNotice>
    <Kb.Text type="BodySmall">
      {props.authorIsYou ? (
        'You'
      ) : (
        <Kb.ConnectedUsernames
          inline={true}
          type="BodySmallSemibold"
          onUsernameClicked="profile"
          colorFollowing={true}
          underline={true}
          usernames={[props.author]}
        />
      )}{' '}
      joined {props.isBigTeam ? `#${props.channelname}` : 'the team'}.
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

export default Joined
