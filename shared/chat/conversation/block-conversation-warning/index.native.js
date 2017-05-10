// @flow
import React from 'react'
import {
  Box,
  Button,
  PopupDialog,
  Text,
  HeaderHoc,
} from '../../../common-adapters/index'
import {globalMargins, globalStyles} from '../../../styles'

import type {Props} from './'

const _Contents = ({
  conversationIDKey,
  onBack,
  participants,
  onBlock,
  onBlockAndReport,
}: Props) => (
  <Box
    style={{
      ...globalStyles.flexBoxColumn,
      alignItems: 'center',
      flex: 1,
      justifyContent: 'flex-start',
      width: '100%',
      paddingTop: 5,
    }}
  >
    <Text type="Header">{`Block the conversation with ${participants}?`}</Text>
    <Text type="Body" style={{marginTop: globalMargins.large}}>
      You won't see this conversation anymore.
    </Text>
    <Text type="Body" style={{marginTop: globalMargins.small}}>
      To unblock it, run:
    </Text>
    <Text
      type="Terminal"
      style={{
        ...globalStyles.selectable,
        alignSelf: 'center',
        marginTop: globalMargins.small,
      }}
    >
      keybase chat hide -u {participants}
    </Text>
    <Text type="Body" style={{marginTop: globalMargins.small}}>
      in the terminal on a desktop computer.
    </Text>
    <Box
      style={{
        ...globalStyles.flexBoxColum,
        marginTop: globalMargins.xlarge,
      }}
    >
      <Button type="Secondary" onClick={onBack} label="No, don't block them" />
      <Button
        type="Danger"
        style={{
          marginLeft: globalMargins.tiny,
          marginTop: globalMargins.medium,
        }}
        onClick={onBlock}
        label="Yes, block them"
      />
      <Button
        type="Danger"
        style={{
          marginLeft: globalMargins.tiny,
          marginTop: globalMargins.small,
        }}
        onClick={onBlockAndReport}
        label="Yes, block them and report abuse"
      />
    </Box>
  </Box>
)

// Wrap it in a Header if its mobile. Normally we'd put HeaderHoc on the whole thing but the Popupdialog needs it to
// apply to the insides and not the outter container.
const Contents = HeaderHoc(_Contents)

const RenderBlockConversationWarning = (props: Props) => (
  <PopupDialog
    onClose={props.onBack}
    styleCover={{
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
    }}
    styleContainer={{borderRadius: 0}}
  >
    <Contents {...props} />
  </PopupDialog>
)

export default RenderBlockConversationWarning
