import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import SystemMessageTimestamp from '../system-message-timestamp'
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
  // Bring more attention to the current user joining
  props.authorIsYou ? (
    <JoinedUserNotice {...props} />
  ) : (
    <Kb.Box2 direction="vertical" fullWidth={true}>
      <Kb.Text type="BodyTiny">{formatTimeForChat(props.timestamp)}</Kb.Text>
      {props.joiners.length > 0 && (
        <Kb.ConnectedUsernames
          type="BodySmallSemibold"
          suffixType="BodySmall"
          onUsernameClicked="profile"
          colorFollowing={true}
          underline={true}
          usernames={props.joiners}
          suffix={` joined ${props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`}`}
        />
      )}
      {props.leavers.length > 0 && (
        <Kb.ConnectedUsernames
          type="BodySmallSemibold"
          suffixType="BodySmall"
          onUsernameClicked="profile"
          colorFollowing={true}
          underline={true}
          usernames={props.leavers}
          suffix={` left ${props.isBigTeam ? `#${props.channelname}.` : `${props.teamname}.`}`}
        />
      )}
    </Kb.Box2>
  )

const JoinedUserNotice = (props: Props) => (
  <UserNotice
    style={{marginTop: Styles.globalMargins.small}}
    username={props.author}
    bgColor={Styles.globalColors.blueLighter2}
  >
    <SystemMessageTimestamp timestamp={props.timestamp} />
    <Kb.Text type="BodySmallSemibold" negative={true} style={{color: Styles.globalColors.black_50}}>
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
      joined{' '}
      {props.isBigTeam ? (
        `#${props.channelname}`
      ) : (
        <Kb.Text type="BodySmallSemibold" style={{color: Styles.globalColors.black_50}}>
          {props.teamname}
        </Kb.Text>
      )}
      .
    </Kb.Text>
    {props.authorIsYou && props.isBigTeam && (
      <Kb.Box style={{...Styles.globalStyles.flexBoxColumn, alignItems: 'center'}}>
        <Kb.Text onClick={props.onManageNotifications} type={textType} center={true}>
          Manage phone and computer notifications
        </Kb.Text>
        <Kb.Text onClick={props.onManageChannels} type={textType}>
          Browse other channels
        </Kb.Text>
      </Kb.Box>
    )}
  </UserNotice>
)

export default Joined
