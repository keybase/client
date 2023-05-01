import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as Constants from '../../../../../constants/chat2'
import * as Container from '../../../../../util/container'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import Journeycard from '.'
import type * as ChatTypes from '../../../../../constants/types/chat2'
import type * as React from 'react'
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
  const {conversationIDKey, ordinal} = ownProps
  const cardType = Container.useSelector(
    state =>
      Constants.getMessage(state, conversationIDKey, ordinal)?.cardType ?? RPCChatTypes.JourneycardType.unused
  )

  const dispatch = Container.useDispatch()
  const _onDismiss = (
    conversationIDKey: ChatTypes.ConversationIDKey,
    cardType: RPCChatTypes.JourneycardType,
    ordinal: ChatTypes.Ordinal
  ) => {
    dispatch(Chat2Gen.createDismissJourneycard({cardType, conversationIDKey, ordinal}))
  }
  const props = {
    attachTo: ownProps.attachTo,
    onDismiss: () => {
      _onDismiss(ownProps.conversationIDKey, cardType, ownProps.ordinal)
    },
    onHidden: () => ownProps.onHidden(),
    position: ownProps.position,
    style: ownProps.style,
    visible: ownProps.visible,
  }
  return <Journeycard {...props} />
}
