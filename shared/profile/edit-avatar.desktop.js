// @flow
import React from 'react'
import {Avatar, Box, Text, Button} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'
import {noAvatarMessage, hasAvatarMessage} from './edit-avatar.shared'

import type {Props} from './edit-avatar'

const Render = ({keybaseUsername, hasAvatar, onAck}: Props) => {
  const text = !hasAvatar ? noAvatarMessage : hasAvatarMessage

  return (
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: globalMargins.large,
      }}
    >
      <Avatar size={176} username={keybaseUsername} />
      <Text
        type="Body"
        style={{
          marginTop: globalMargins.medium,
          textAlign: 'center',
          maxWidth: 560,
        }}
      >
        {text}
      </Text>
      <Button
        type="Primary"
        onClick={onAck}
        label="Got it!"
        style={{marginTop: globalMargins.medium}}
      />
    </Box>
  )
}

export default Render
