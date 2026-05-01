import * as Kb from '@/common-adapters'
import * as T from '@/constants/types'
import type * as React from 'react'
import type {Position, StylesCrossPlatform} from '@/styles'
import {dismissConversationJourneycard} from '../../message-actions'
import {
  useConversationThreadDismissJourneycard,
  useConversationThreadID,
  useConversationThreadMessage,
} from '../../thread-context'

type OwnProps = {
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  conversationIDKey?: T.Chat.ConversationIDKey
  message?: T.Chat.Message
  mode?: 'modal' | 'bottomsheet'
  onHidden: () => void
  ordinal: T.Chat.Ordinal
  position: Position
  style?: StylesCrossPlatform
  visible: boolean
}

const JourneyCardLoaded = (ownProps: OwnProps & {
  cardType: T.RPCChat.JourneycardType
  onDismissCard: () => void
}) => {
  const {attachTo, cardType, mode, onDismissCard, onHidden, style, visible, position} = ownProps

  const onDismiss = () => {
    if (cardType !== T.RPCChat.JourneycardType.unused) {
      onDismissCard()
    }
  }

  const items: Kb.MenuItems = [{icon: 'iconfont-close', onClick: onDismiss, title: 'Dismiss message'}]

  return (
    <Kb.FloatingMenu
      attachTo={attachTo}
      closeOnSelect={true}
      items={items}
      mode={mode}
      onHidden={onHidden}
      position={position}
      containerStyle={style}
      visible={visible}
      safeProviderStyle={safeProviderStyle}
    />
  )
}

const JourneyCardThread = (ownProps: OwnProps) => {
  const {ordinal} = ownProps
  const conversationIDKey = useConversationThreadID()
  const cardType = useConversationThreadMessage(ordinal)?.cardType ?? T.RPCChat.JourneycardType.unused
  const dismissJourneycard = useConversationThreadDismissJourneycard()
  return (
    <JourneyCardLoaded
      {...ownProps}
      cardType={cardType}
      conversationIDKey={conversationIDKey}
      onDismissCard={() => dismissJourneycard(cardType, ordinal)}
    />
  )
}

const JourneyCardStoreless = (ownProps: OwnProps & {conversationIDKey: T.Chat.ConversationIDKey}) => {
  const cardType = ownProps.message?.cardType ?? T.RPCChat.JourneycardType.unused
  return (
    <JourneyCardLoaded
      {...ownProps}
      cardType={cardType}
      onDismissCard={() => dismissConversationJourneycard(ownProps.conversationIDKey, cardType)}
    />
  )
}

const JourneyCard = (ownProps: OwnProps) =>
  ownProps.conversationIDKey && ownProps.message ? (
    <JourneyCardStoreless
      {...ownProps}
      conversationIDKey={ownProps.conversationIDKey}
    />
  ) : (
    <JourneyCardThread {...ownProps} />
  )

const safeProviderStyle = {flex: 1} as const
export default JourneyCard
