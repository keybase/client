// @flow
import React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../../notices/user-notice'
import {globalColors, globalMargins} from '../../../../styles'

import type {Props} from '.'

const OldProfileResetNotice = ({username, onOpenNewerConversation}: Props) =>
  <UserNotice style={{marginBottom: globalMargins.small}} username={username} bgColor={globalColors.red}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements">
      {username} reset their profile
    </Text>
    <Text type="BodySmall" backgroundMode="Announcements">
      Their encryption keys were replaced with new ones.
    </Text>
    <Text type="BodySmallPrimaryLink" backgroundMode="Announcements" onClick={onOpenNewerConversation}>
      Jump to new conversation
    </Text>
  </UserNotice>

export default OldProfileResetNotice
