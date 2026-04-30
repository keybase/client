import * as C from '@/constants'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import AttachmentMessage from './attachment'
import JourneycardMessage from './journeycard'
import TextMessage from './text'
import {useConversationMessageByOrdinal} from '../../data-hooks'
import {useConversationThreadMessage} from '../../thread-context'
import * as T from '@/constants/types'

type Props = {
  ordinal: T.Chat.Ordinal
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  conversationIDKey?: T.Chat.ConversationIDKey
  message?: T.Chat.Message
  mode?: 'modal' | 'bottomsheet'
  onHidden: () => void
  position: Kb.Styles.Position
  style?: Kb.Styles.StylesCrossPlatform
  visible: boolean
}

function MessagePopupLoaded(p: Props & {message?: T.Chat.Message}) {
  const {ordinal, attachTo, conversationIDKey, message, onHidden, position, style, visible, mode} = p
  const type = message?.type
  switch (type) {
    case 'text':
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
          ordinal={ordinal}
          conversationIDKey={conversationIDKey}
          message={message}
          attachTo={attachTo}
          mode={mode}
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
          message={message}
          mode={mode}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'attachment':
      return (
        <AttachmentMessage
          attachTo={attachTo}
          conversationIDKey={conversationIDKey}
          message={message}
          mode={mode}
          ordinal={ordinal}
          onHidden={onHidden}
          position={position}
          style={style}
          visible={visible}
        />
      )
    case 'deleted':
    case 'requestPayment':
    case 'sendPayment':
    case 'systemCreateTeam':
    case 'placeholder':
    case 'systemJoined':
    case 'systemLeft':
    case undefined:
      return null
  }
}

function ThreadMessagePopup(p: Props) {
  const message = useConversationThreadMessage(p.ordinal)
  return <MessagePopupLoaded {...p} message={message} />
}

// Mobile only
type ModalProps = {conversationIDKey?: T.Chat.ConversationIDKey; ordinal: T.Chat.Ordinal}
export const MessagePopupModal = (p: ModalProps) => {
  const {ordinal} = p
  const conversationIDKey = p.conversationIDKey ?? T.Chat.noConversationIDKey
  const message = useConversationMessageByOrdinal(conversationIDKey, ordinal)
  const {pop} = C.useNav()
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo} = p
    return pop ? (
      <MessagePopupLoaded
        ordinal={ordinal}
        key="popup"
        attachTo={attachTo}
        conversationIDKey={conversationIDKey}
        message={message}
        mode="modal"
        onHidden={pop}
        position="top right"
        visible={true}
      />
    ) : null
  }
  const {popup, popupAnchor, showPopup, showingPopup} = Kb.usePopup2(makePopup)
  if (!showingPopup) {
    showPopup()
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} ref={popupAnchor}>
      {popup}
    </Kb.Box2>
  )
}

export const useMessagePopup = (p: {
  conversationIDKey?: T.Chat.ConversationIDKey
  message?: T.Chat.Message
  ordinal: T.Chat.Ordinal
  shouldShow?: () => boolean
  style?: Kb.Styles.StylesCrossPlatform
}) => {
  const {conversationIDKey, message, ordinal, shouldShow, style} = p
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    const Popup = conversationIDKey && message ? MessagePopupLoaded : ThreadMessagePopup
    return (shouldShow?.() ?? true) ? (
      <Popup
        ordinal={ordinal}
        key="popup"
        attachTo={attachTo}
        conversationIDKey={conversationIDKey}
        message={message}
        mode="bottomsheet"
        onHidden={hidePopup}
        position="top right"
        style={style}
        visible={true}
      />
    ) : null
  }
  return Kb.usePopup2(makePopup)
}
