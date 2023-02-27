import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as React from 'react'
import AttachmentMessage from './attachment/container'
import ExplodingMessage from './exploding/container'
import JourneycardMessage from './journeycard/container'
import PaymentMessage from './payment/container'
import TextMessage from './text/container'
import type * as Types from '../../../../constants/types/chat2'
import type {Position, StylesCrossPlatform} from '../../../../styles'

type Props = {
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  attachTo?: () => React.Component<any> | null
  onHidden: () => void
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const MessagePopup = React.memo(function MessagePopup(p: Props) {
  const {conversationIDKey, ordinal, attachTo, onHidden, position, style, visible} = p
  const exploding = Container.useSelector(
    state => Constants.getMessage(state, conversationIDKey, ordinal)?.exploding
  )
  const type = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal)?.type)
  switch (type) {
    case 'text':
      if (exploding) {
        return (
          <ExplodingMessage
            conversationIDKey={conversationIDKey}
            ordinal={ordinal}
            attachTo={attachTo}
            onHidden={onHidden}
            position={position}
            style={style}
            visible={visible}
          />
        )
      }
      return (
        <TextMessage
          conversationIDKey={conversationIDKey}
          ordinal={ordinal}
          attachTo={attachTo}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'setChannelname':
    case 'setDescription':
    case 'pin':
    case 'systemAddedToTeam':
    case 'systemChangeRetention':
    case 'systemGitPush':
    case 'systemInviteAccepted':
    case 'systemSBSResolved':
    case 'systemSimpleToComplex':
    case 'systemChangeAvatar':
    case 'systemNewChannel':
    case 'systemText':
    case 'systemUsersAddedToConversation':
      return (
        <TextMessage
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'journeycard':
      return (
        <JourneycardMessage
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'attachment':
      if (exploding) {
        return (
          <ExplodingMessage
            attachTo={attachTo}
            conversationIDKey={conversationIDKey}
            ordinal={ordinal}
            onHidden={onHidden}
            position={position}
            style={style}
            visible={visible}
          />
        )
      }
      return (
        <AttachmentMessage
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'sendPayment': // fallthrough
    case 'requestPayment':
      return (
        <PaymentMessage
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
  }
  return null
})

export default MessagePopup
