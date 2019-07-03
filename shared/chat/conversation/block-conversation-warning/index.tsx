import * as React from 'react'
import * as Types from '../../../constants/types/chat2'
import {Box, Button, PopupDialog, Text, StandardScreen, ButtonBar} from '../../../common-adapters/index'
import {globalMargins, globalStyles, globalColors, isMobile} from '../../../styles'

type Props = {
  conversationIDKey: Types.ConversationIDKey
  onBack: () => void
  onBlock: () => void
  onBlockAndReport: () => void
  participants: string
}

const _Contents = ({conversationIDKey, onBack, participants, onBlock, onBlockAndReport}: Props) => (
  <StandardScreen
    onBack={isMobile ? onBack : null}
    style={{
      paddingLeft: 0,
      paddingRight: 0,
    }}
  >
    <Box
      style={{
        ...globalStyles.flexBoxColumn,
        justifyContent: 'flex-start',
      }}
    >
      <Box style={{...globalStyles.flexBoxColumn, padding: globalMargins.medium}}>
        <Text
          type="Header"
          style={{alignSelf: 'center'}}
        >{`Block the conversation with ${participants}?`}</Text>
        <Text type="Body" style={{marginTop: globalMargins.medium}}>
          You won't see this conversation anymore.
        </Text>
        <Text type="Body" style={{marginTop: globalMargins.small}}>
          To unblock it, enter the command:
        </Text>
        <Box
          style={{
            backgroundColor: globalColors.blueDarker,
            marginBottom: globalMargins.small,
            marginTop: globalMargins.small,
            padding: globalMargins.tiny,
          }}
        >
          <Text type="Terminal" selectable={true} style={{alignSelf: 'center'}}>
            /unhide {participants}
          </Text>
        </Box>
        <Text type="Body">into any chat compose box.</Text>
      </Box>
      <ButtonBar direction="column">
        <Button type="Dim" onClick={onBack} label="No, don't block them" />
        <Button type="Danger" onClick={onBlock} label="Yes, block them" />
        <Button type="Danger" onClick={onBlockAndReport} label="Yes, block and report abuse" />
      </ButtonBar>
    </Box>
  </StandardScreen>
)

// Wrap it in a Header if its mobile. Normally we'd put HeaderHoc on the whole thing but the Popupdialog needs it to
// apply to the insides and not the outter container.
const Contents = _Contents

const RenderBlockConversationWarning = (props: Props) =>
  isMobile ? (
    <Contents {...props} />
  ) : (
    <PopupDialog onClose={props.onBack}>
      <Contents {...props} />
    </PopupDialog>
  )

export default RenderBlockConversationWarning
