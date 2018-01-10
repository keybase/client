// @flow
import * as React from 'react'
import {Text, Usernames} from '../../../../common-adapters'
import UserNotice from '../../notices/user-notice'
import {globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {TextMessage} from '../../../../constants/types/chat'

type Props = {
  channelname: string,
  isBigTeam: boolean,
  message: TextMessage,
  onManageChannels: () => void,
  onUsernameClicked: (username: string) => void,
  teamname: string,
  following: boolean,
  you: string,
}

const JoinedLeftNotice = ({
  channelname,
  message,
  isBigTeam,
  onManageChannels,
  you,
  teamname,
  following,
  onUsernameClicked,
}: Props) => (
  <UserNotice style={{marginTop: globalMargins.small}} username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(message.timestamp)}
    </Text>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {you === message.author ? (
        'You'
      ) : (
        <Usernames
          inline={true}
          type="BodySmallSemibold"
          onUsernameClicked={onUsernameClicked}
          colorFollowing={true}
          users={[{username: message.author, following, you: you === message.author}]}
        />
      )}{' '}
      {message.message.stringValue()}{' '}
      {isBigTeam ? (
        `#${channelname}`
      ) : (
        <Text type="BodySmallSemibold" style={{color: globalColors.black_60}}>
          {teamname}
        </Text>
      )}.
    </Text>
    {message.author === you &&
      isBigTeam && (
        <Text
          backgroundMode="Announcements"
          onClick={onManageChannels}
          style={{color: globalColors.blue}}
          type="BodySmallSemibold"
        >
          Manage channel subscriptions.
        </Text>
      )}
  </UserNotice>
)

export default JoinedLeftNotice
