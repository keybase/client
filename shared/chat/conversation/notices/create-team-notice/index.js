// @flow
import React from 'react'
import {Text} from '../../../../common-adapters'
import UserNotice from '../user-notice'
import {globalColors} from '../../../../styles'

import type {Props} from '.'

const CreateTeamNotice = ({onShowNewTeamDialog}: Props) => (
  <UserNotice username="" bgColor={globalColors.blue4}>
    <Text type="BodySmallSemibold" backgroundMode="Announcements" style={{color: globalColors.black_40}}>
      Make it a team? You'll be able to add and delete members as you wish.
    </Text>
    <Text
      type="BodySmallPrimaryLink"
      backgroundMode="Announcements"
      style={{color: globalColors.blue}}
      onClick={onShowNewTeamDialog}
    >
      Enter a team name
    </Text>
  </UserNotice>
)

export default CreateTeamNotice
