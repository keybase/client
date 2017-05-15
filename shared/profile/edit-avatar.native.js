// @flow
import React from 'react'
import {Avatar, Box, Text, Button} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'
import {noAvatarMessage, hasAvatarMessage} from './edit-avatar.shared'

import type {Props} from './edit-avatar'

const EditAvatar = ({keybaseUsername, hasAvatar, onAck}: Props) => {
  const text = !hasAvatar ? noAvatarMessage : hasAvatarMessage

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.small}}>
        <Avatar size={176} username={keybaseUsername} />
        <Text type="Body" style={styleCaption}>{text}</Text>
        <Button type="Primary" fullWidth={true} onClick={onAck} label="Got it!" style={styleButton} />
      </Box>
    </Box>
  )
}

const styleCaption = {
  marginTop: globalMargins.medium,
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  textAlign: 'center',
}

const styleButton = {
  marginTop: globalMargins.medium,
  alignSelf: 'stretch',
}

export default EditAvatar
