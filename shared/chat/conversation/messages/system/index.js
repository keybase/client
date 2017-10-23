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
  teamname: string,
  you: string,
}

const SystemNotice = ({channelname, message, onManageChannels, you}: Props) => (
  <UserNotice style={{marginTop: globalMargins.small}} username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {formatTimeForMessages(message.timestamp)}
    </Text>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {message.author === you ? 'You' : message.author}
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
