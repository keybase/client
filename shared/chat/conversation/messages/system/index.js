// @flow
import * as React from 'react'
import {Text} from '../../../../common-adapters'
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
    {message.message.stringValue().split('\n').map((line, index) => (
      <Text
        key={index}
        type="BodySmallSemibold"
        backgroundMode="Announcements"
        style={{color: globalColors.black_40}}
      >
        {line}
      </Text>
    ))}
  </UserNotice>
)

export default SystemNotice
