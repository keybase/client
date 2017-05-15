// @flow
import React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const ProfileResetNotice = ({username, onOpenOlderConversation}: Props) => (
  <UserNotice username={username} bgColor={globalColors.blue4}>
    <Text
      type="BodySmallSemibold"
      backgroundMode="Announcements"
      style={{color: globalColors.black_40}}
    >
      {username} reset their profile
    </Text>
    <Text
      type="BodySmallPrimaryLink"
      backgroundMode="Announcements"
      style={{color: globalColors.black_60}}
      onClick={onOpenOlderConversation}
    >
      View older conversation
    </Text>
  </UserNotice>
)

export default ProfileResetNotice
