import * as React from 'react'
import * as Chat2Gen from '../../../../../actions/chat2-gen'
import * as ChatTypes from '../../../../../constants/types/chat2'
import * as RPCChatTypes from '../../../../../constants/types/rpc-chat-gen'
import * as Container from '../../../../../util/container'
import {Position} from '../../../../../common-adapters/relative-popup-hoc.types'
import {StylesCrossPlatform} from '../../../../../styles/css'
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

export default Container.namedConnect(
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
  },
  'MessagePopupJourneycard'
)(Journeycard)
