// @flow
import * as React from 'react'
import {Text, Usernames} from '../../../../common-adapters'
import UserNotice from '../../notices/user-notice'
import {globalColors, globalMargins} from '../../../../styles'
import {formatTimeForMessages} from '../../../../util/timestamp'

import type {TextMessage} from '../../../../constants/chat'

type Props = {
  channelname: string,
  message: TextMessage,
  onManageChannels: () => void,
  onUsernameClicked: (username: string) => void,
  teamname: string,
  following: boolean,
  you: string,
}

const SystemNotice = ({channelname, message, onManageChannels, you, following, onUsernameClicked}: Props) => (
  <UserNotice style={{marginTop: globalMargins.small}} username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(message.timestamp)}
    </Text>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      <Usernames
        inline={true}
        type="BodySmallSemibold"
        onUsernameClicked={onUsernameClicked}
        colorFollowing={true}
        users={[{username: message.author, following, you: you === message.author}]}
      />
      {' '}
      {message.message.stringValue()}
      {' '}
      #{channelname}.
    </Text>
    {message.author === you &&
      <Text
        backgroundMode="Announcements"
        onClick={onManageChannels}
        style={{color: globalColors.blue}}
        type="BodySmallPrimaryLink"
      >
        Manage channel subscriptions.
      </Text>}
  </UserNotice>
)

export default SystemNotice
