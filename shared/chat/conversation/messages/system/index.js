// @flow
import * as React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../../notices/user-notice'
import {globalColors} from '../../../../styles'

import type {TextMessage} from '../../../../constants/chat'

type Props = {
  message: TextMessage,
}

const SystemNotice = ({message}: Props) => (
  <UserNotice username={message.author} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      {message.message.stringValue()}
    </Text>
  </UserNotice>
)

export default SystemNotice
