// @flow
import * as React from 'react'
import {Avatar, Box, Text, Button, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {noAvatarMessage, hasAvatarMessage} from './shared'

import type {Props} from '.'

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
      <Avatar size={128} username={keybaseUsername} />
      <Text type="Body" style={{marginTop: globalMargins.medium, textAlign: 'center', maxWidth: 560}}>
        {text}
      </Text>
      <ButtonBar>
        <Button type="Primary" onClick={onAck} label="Got it!" />
      </ButtonBar>
    </Box>
  )
}

export default Render
