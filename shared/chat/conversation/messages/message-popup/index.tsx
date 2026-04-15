import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as ConvoState from '@/stores/convostate'
import * as Kb from '@/common-adapters'
import type * as React from 'react'
import AttachmentMessage from './attachment'
import JourneycardMessage from './journeycard'
import TextMessage from './text'
import type * as T from '@/constants/types'

type Props = {
  ordinal: T.Chat.Ordinal
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  mode?: 'modal' | 'bottomsheet'
  onHidden: () => void
  position: Kb.Styles.Position
  style?: Kb.Styles.StylesCrossPlatform
  visible: boolean
}

function MessagePopup(p: Props) {
  const {ordinal, attachTo, onHidden, position, style, visible, mode} = p
  const type = ConvoState.useChatContext(s => s.messageMap.get(ordinal)?.type)
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

// Mobile only
type ModalProps = {ordinal: T.Chat.Ordinal}
export const MessagePopupModal = (p: ModalProps) => {
  const {ordinal} = p
  const {pop} = C.useNav()
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo} = p
    return pop ? (
      <MessagePopup
        ordinal={ordinal}
        key="popup"
        attachTo={attachTo}
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
  ordinal: T.Chat.Ordinal
  shouldShow?: () => boolean
  style?: Kb.Styles.StylesCrossPlatform
}) => {
  const conversationIDKey = ConvoState.useChatContext(s => s.id)
  const {ordinal, shouldShow, style} = p
  const makePopup = (p: Kb.Popup2Parms) => {
    const {attachTo, hidePopup} = p
    return (shouldShow?.() ?? true) ? (
      <ConvoState.ChatProvider id={conversationIDKey}>
        <MessagePopup
          ordinal={ordinal}
          key="popup"
          attachTo={attachTo}
          mode="bottomsheet"
          onHidden={hidePopup}
          position="top right"
          style={style}
          visible={true}
        />
      </ConvoState.ChatProvider>
    ) : null
  }
  return Kb.usePopup2(makePopup)
}
