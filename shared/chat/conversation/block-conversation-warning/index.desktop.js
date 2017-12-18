// @flow
import * as React from 'react'
import {Box, Button, PopupDialog, Text, ButtonBar} from '../../../common-adapters/index'
import {globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

const Contents = ({conversationIDKey, onBack, participants, onBlock, onBlockAndReport}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'center',
      marginBottom: 80,
      marginLeft: 80,
      marginRight: 80,
      marginTop: 90,
    }}
  >
    <Text type="Header">Block the conversation with {participants}?</Text>
    <Text type="Body" style={{marginTop: globalMargins.large}}>You won't see this conversation anymore.</Text>
    <Text type="Body" style={{marginTop: globalMargins.small}}>To unblock it, run:</Text>
    <Text
      type="Terminal"
      style={{...globalStyles.selectable, alignSelf: 'center', marginTop: globalMargins.small}}
    >
      keybase chat hide -u {participants}
    </Text>
    <Text type="Body" style={{marginTop: globalMargins.small}}>in the terminal.</Text>
    <ButtonBar>
      <Button type="Secondary" onClick={onBack} label="No, don't block them" />
      <Button type="Danger" onClick={onBlock} label="Yes, block them" />
      <Button type="Danger" onClick={onBlockAndReport} label="Yes, block them and report abuse" />
    </ButtonBar>
  </Box>
)

const RenderBlockConversationWarning = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

export default RenderBlockConversationWarning
