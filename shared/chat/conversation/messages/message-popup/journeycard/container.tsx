import * as C from '../../../../../constants'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import Journeycard from '.'
import type * as ChatTypes from '../../../../../constants/types/chat2'
import * as React from 'react'
import type {Position, StylesCrossPlatform} from '../../../../../styles'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  ordinal: ChatTypes.Ordinal
  conversationIDKey: ChatTypes.ConversationIDKey
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

export default (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const cardType = C.useChatContext(
    s => s.messageMap.get(ordinal)?.cardType ?? RPCChatTypes.JourneycardType.unused
  )

  const dismissJourneycard = C.useChatContext(s => s.dispatch.dismissJourneycard)
  const _onDismiss = (cardType: RPCChatTypes.JourneycardType, ordinal: ChatTypes.Ordinal) => {
    dismissJourneycard(cardType, ordinal)
  }
  const props = {
    attachTo: ownProps.attachTo,
    onDismiss: () => {
      _onDismiss(cardType, ownProps.ordinal)
    },
    onHidden: () => ownProps.onHidden(),
    position: ownProps.position,
    style: ownProps.style,
    visible: ownProps.visible,
  }
  return <Journeycard {...props} />
}
