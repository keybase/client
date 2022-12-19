import type * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import type * as ChatTypes from '../../../../../constants/types/chat2'
import type * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as Container from '../../../../../util/container'
import type {Position, StylesCrossPlatform} from '../../../../../styles'
import Journeycard from '.'

type OwnProps = {
  attachTo?: () => React.Component<any> | null
  message: ChatTypes.MessageJourneycard
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const mapDispatchToProps = (dispatch: Container.TypedDispatch) => ({
  _onDismiss: (
    conversationIDKey: ChatTypes.ConversationIDKey,
    cardType: RPCChatTypes.JourneycardType,
    ordinal: ChatTypes.Ordinal
  ) => dispatch(Chat2Gen.createDismissJourneycard({cardType, conversationIDKey, ordinal})),
})

export default Container.connect(
  () => ({}),
  mapDispatchToProps,
  (_stateProps, dispatchProps, ownProps: OwnProps) => {
    return {
      attachTo: ownProps.attachTo,
      onDismiss: () => {
        dispatchProps._onDismiss(
          ownProps.message.conversationIDKey,
          ownProps.message.cardType,
          ownProps.message.ordinal
        )
      },
      onHidden: () => ownProps.onHidden(),
      position: ownProps.position,
      style: ownProps.style,
      visible: ownProps.visible,
    }
  }
)(Journeycard)
