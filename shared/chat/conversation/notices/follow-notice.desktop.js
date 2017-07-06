// @flow
import React from 'react'
import {Text} from '../../../common-adapters'
import UserNotice from './user-notice'
import {globalColors} from '../../../styles'

import type {Props} from './follow-notice'

const FollowNotice = ({username}: Props) =>
  <UserNotice username={username} bgColor={globalColors.green}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements">
      You started following {username}.
    </Text>
  </UserNotice>

export default FollowNotice
