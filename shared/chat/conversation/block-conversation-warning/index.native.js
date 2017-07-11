// @flow
import React from 'react'
import {Box, Button, PopupDialog, Text, StandardScreen} from '../../../common-adapters/index'
import {globalMargins, globalStyles, globalColors} from '../../../styles'

import type {Props} from './'

const _Contents = ({conversationIDKey, onBack, participants, onBlock, onBlockAndReport}: Props) => (
  <StandardScreen
    onBack={onBack}
    style={{
      paddingLeft: 0,
      paddingRight: 0,
    }}
  >
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        justifyContent: 'flex-start',
        paddingTop: 5,
      }}
    >
      <Box style={{paddingLeft: globalMargins.medium, paddingRight: globalMargins.medium}}>
        <Text
          type="Header"
          style={{alignSelf: 'center'}}
        >{`Block the conversation with ${participants}?`}</Text>
        <Text type="Body" style={{marginTop: globalMargins.medium}}>
          You won't see this conversation anymore.
        </Text>
        <Text type="Body" style={{marginTop: globalMargins.small}}>To unblock it, run:</Text>
        <Box
          style={{
            backgroundColor: globalColors.darkBlue,
            marginTop: globalMargins.small,
            marginBottom: globalMargins.small,
            padding: globalMargins.tiny,
          }}
        >
          <Text type="Terminal" style={{...globalStyles.selectable, alignSelf: 'center'}}>
            keybase chat hide -u {participants}
          </Text>
        </Box>
        <Text type="Body">in the terminal on a desktop computer.</Text>
      </Box>
      <Box style={{...globalStyles.flexBoxColum, marginTop: globalMargins.medium}}>
        <Button type="Secondary" onClick={onBack} label="No, don't block them" />
        <Button
          type="Danger"
          style={{marginTop: globalMargins.medium}}
          onClick={onBlock}
          label="Yes, block them"
        />
        <Button
          type="Danger"
          style={{marginTop: globalMargins.small}}
          onClick={onBlockAndReport}
          label="Yes, block and report abuse"
        />
      </Box>
    </Box>
  </StandardScreen>
)

// Wrap it in a Header if its mobile. Normally we'd put HeaderHoc on the whole thing but the Popupdialog needs it to
// apply to the insides and not the outter container.
const Contents = _Contents

const RenderBlockConversationWarning = (props: Props) => (
  <PopupDialog
    onClose={props.onBack}
    styleCover={{paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0}}
    styleContainer={{borderRadius: 0, width: '100%'}}
  >
    <Contents {...props} />
  </PopupDialog>
)

export default RenderBlockConversationWarning
