// @flow
import * as React from 'react'
import {StandardScreen, Avatar, Box, Text, Button, ButtonBar} from '../../common-adapters'
import {globalStyles, globalMargins} from '../../styles'
import {noAvatarMessage, hasAvatarMessage} from './shared'
import type {Props} from '.'

const EditAvatar = ({keybaseUsername, hasAvatar, onAck}: Props) => {
  const text = !hasAvatar ? noAvatarMessage : hasAvatarMessage

  return (
    <StandardScreen style={{...globalStyles.flexBoxColumn, flex: 1}} onBack={onAck}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.small}}>
        <Avatar size={128} username={keybaseUsername} />
        <Text center={true} type="Body" style={styleCaption}>
          {text}
        </Text>
        <ButtonBar>
          <Button type="Primary" fullWidth={true} onClick={onAck} label="Got it!" />
        </ButtonBar>
      </Box>
    </StandardScreen>
  )
}

const styleCaption = {
  marginLeft: globalMargins.small,
  marginRight: globalMargins.small,
  marginTop: globalMargins.medium,
}

export default EditAvatar
