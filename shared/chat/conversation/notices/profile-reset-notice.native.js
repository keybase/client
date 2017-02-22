// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'

import type {Props} from './profile-reset-notice'

const ProfileResetNotice = ({username, onOpenOlderConversation}: Props) => (
  <Box>
    <Text type='BodySmallSemibold'>TODO profile reset notice. {username} reset their profile.</Text>
    <Text type='BodySmallPrimaryLink' onClick={onOpenOlderConversation}>View the older Conversation</Text>
  </Box>
)

export default ProfileResetNotice
