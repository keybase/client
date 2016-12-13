// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import UserNotice from './user-notice'
import {globalColors} from '../../../styles'

import type {Props} from './old-profile-reset-notice'

const OldProfileResetNotice = ({username, onOpenNewerConversation}: Props) => (
  <UserNotice username={username} bgColor={globalColors.red}>
    <Text type='BodySmallSemibold' backgroundMode='Announcements'>{username} reset their profile</Text>
    <Text type='BodySmall' backgroundMode='Announcements'>Their encryption keys were replaced with new ones.</Text>
    <Text type='BodySmallPrimaryLink' backgroundMode='Announcements' onClick={onOpenNewerConversation}>Jump to new conversation</Text>
  </UserNotice>
)

export default OldProfileResetNotice
