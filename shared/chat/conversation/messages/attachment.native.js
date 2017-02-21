// @flow
import React from 'react'
import {Box, Text} from '../../../common-adapters'

import type {Props} from './attachment'

const AttachmentMessage = ({message}: Props) => (
  <Box>
    <Text>Attachment Message (TODO) - {message.title}</Text>
  </Box>
)

export default AttachmentMessage
