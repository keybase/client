/* @flow */

import React from 'react'
import {Avatar, Box, Text, Button} from '../common-adapters'
import {globalStyles, globalMargins} from '../styles'

import type {Props} from './edit-avatar'

const Render = ({keybaseUsername, hasAvatar, onAck}: Props) => {
  const text = !hasAvatar ? 'Keybase shows your profile photo from your Twitter or Github proofs. Please add a proof to your profile.'
    : "For now, Keybase shows your profile photo from your Twitter or Github proofs. If you'd like to prioritize one service, you can change that setting on the Keybase website."

  return (
    <Box style={{...globalStyles.flexBoxColumn, flex: 1}}>
      <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', padding: globalMargins.large}}>
        <Avatar size={176} username={keybaseUsername} />
        <Text type='Body' style={{marginTop: globalMargins.medium, textAlign: 'center'}}>{text}</Text>
        <Button type='Primary' onClick={onAck} label='Got it!' style={{marginTop: globalMargins.medium}} />
      </Box>
    </Box>
  )
}

export default Render
