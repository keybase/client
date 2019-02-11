// @flow
import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import UserNotice from '../user-notice'
import {formatTimeForMessages} from '../../../../util/timestamp'

type Props = {|
  author: string,
  authorIsYou: boolean,
  channelname: string,
  isBigTeam: boolean,
  onManageChannels: () => void,
  teamname: string,
  timestamp: number,
|}

const Joined = (props: Props) =>
  // Bring more attention to the current user joining
  props.authorIsYou ? (
    <JoinedUserNotice {...props} />
  ) : (
    <Kb.Text type="BodySmall" style={styles.text}>
      joined {props.isBigTeam ? `#${props.channelname}` : props.teamname}
      {'. '}
      {props.authorIsYou && props.isBigTeam && (
        <Kb.Text
          title=""
          onClick={props.onManageChannels}
          style={{color: Styles.globalColors.blue}}
          type="BodySmall"
        >
          Manage channel subscriptions.
        </Kb.Text>
      )}
    </Kb.Text>
  )

const JoinedUserNotice = (props: Props) => (
  <UserNotice
    style={{marginTop: Styles.globalMargins.small}}
    username={props.author}
    bgColor={Styles.globalColors.blue4}
  >
    <Kb.Text
      type="BodySmallSemibold"
      backgroundMode="Announcements"
      style={{color: Styles.globalColors.black_50}}
    >
      {formatTimeForMessages(props.timestamp)}
    </Kb.Text>
    <Kb.Text
      type="BodySmallSemibold"
      backgroundMode="Announcements"
      style={{color: Styles.globalColors.black_50}}
    >
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
      <Kb.Text
        backgroundMode="Announcements"
        onClick={props.onManageChannels}
        style={{color: Styles.globalColors.blue}}
        type="BodySmallSemibold"
      >
        Manage channel subscriptions.
      </Kb.Text>
    )}
  </UserNotice>
)

const styles = Styles.styleSheetCreate({
  text: {flexGrow: 1},
})

export default Joined
