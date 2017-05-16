// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import UserNotice from './user-notice'
import {globalColors} from '../../../styles'

import type {Props} from './unfollow-notice'

const UnfollowNotice = ({username}: Props) => (
  <UserNotice username={username} bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      You stopped following {username}.
    </Text>
  </UserNotice>
)

export default UnfollowNotice
