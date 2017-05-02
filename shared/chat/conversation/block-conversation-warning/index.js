// @flow
import React from 'react'
import {Box, Button, PopupDialog, Text, HeaderHoc} from '../../../common-adapters/index'
import {globalMargins, globalStyles} from '../../../styles'
import {isMobile} from '../../../constants/platform'
import {branch} from 'recompose'

import type {Props} from './'

const contentStyle = isMobile
  ? {marginLeft: 40, marginRight: 40}
  : {marginBottom: 80, marginLeft: 80, marginRight: 80, marginTop: 90}

const actionStyle = isMobile
  ? {...globalStyles.flexBoxColumn}
  : {...globalStyles.flexBoxRow}

const _Contents = ({conversationIDKey, onBack, participants, onBlock}: Props) => (
  <Box style={{...globalStyles.flexBoxColumn, alignItems: 'center', flex: 1, justifyContent: 'center', ...contentStyle}}>
    <Text type='Header'>Block the conversation with {participants}?</Text>
    <Text type='Body' style={{marginTop: globalMargins.large}}>You won't see this conversation anymore.</Text>
    <Text type='Body' style={{marginTop: globalMargins.small}}>To unblock it, run:</Text>
    <Text type='Terminal' style={{...globalStyles.selectable, alignSelf: 'center', marginTop: globalMargins.small}}>keybase chat hide -u {participants}</Text>
    <Text type='Body' style={{marginTop: globalMargins.small}}>in the terminal{isMobile && ' on a desktop computer'}.</Text>
    <Box style={{...actionStyle, marginTop: globalMargins.xlarge}}>
      <Button type='Secondary' onClick={onBack} label="No, don't block them" />
      <Button type='Danger' style={{marginLeft: globalMargins.tiny, marginTop: globalMargins.small}} onClick={onBlock} label='Yes, block them' />
    </Box>
  </Box>
)

// Wrap it in a Header if its mobile. Normally we'd put HeaderHoc on the whole thing but the Popupdialog needs it to
// apply to the insides and not the outter container.
const Contents = branch(
  () => isMobile,
  HeaderHoc
)(_Contents)

const RenderBlockConversationWarning = (props: Props) => (
  <PopupDialog onClose={props.onBack}>
    <Contents {...props} />
  </PopupDialog>
)

export default RenderBlockConversationWarning
