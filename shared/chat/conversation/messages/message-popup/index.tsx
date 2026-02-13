import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import AttachmentMessage from './attachment'
import JourneycardMessage from './journeycard'
import TextMessage from './text'
import type * as T from '@/constants/types'

type Props = {
  ordinal: T.Chat.Ordinal
  attachTo?: React.RefObject<Kb.MeasureRef | null>
  onHidden: () => void
  position: Kb.Styles.Position
  style?: Kb.Styles.StylesCrossPlatform
  visible: boolean
}

const MessagePopup = React.memo(function MessagePopup(p: Props) {
  const {ordinal, attachTo, onHidden, position, style, visible} = p
  const type = Chat.useChatContext(s => s.messageMap.get(ordinal)?.type)
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
})

// Mobile only
type ModalProps = {ordinal: T.Chat.Ordinal}
export const MessagePopupModal = (p: ModalProps) => {
  const {ordinal} = p
  const {pop} = C.useNav()
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo} = p
      return pop ? (
        <Kb.FloatingModalContext.Provider value={true}>
          <MessagePopup
            ordinal={ordinal}
            key="popup"
            attachTo={attachTo}
            onHidden={pop}
            position="top right"
            visible={true}
          />
        </Kb.FloatingModalContext.Provider>
      ) : null
    },
    [ordinal, pop]
  )
  const {popup, popupAnchor, showPopup, showingPopup} = Kb.usePopup2(makePopup)
  if (!showingPopup) {
    showPopup()
  }

  return (
    <Kb.Box2Measure direction="vertical" fullWidth={true} fullHeight={true} ref={popupAnchor}>
      {popup}
    </Kb.Box2Measure>
  )
}

export const useMessagePopup = (p: {
  ordinal: T.Chat.Ordinal
  shouldShow?: () => boolean
  style?: Kb.Styles.StylesCrossPlatform
}) => {
  const conversationIDKey = Chat.useChatContext(s => s.id)
  const {ordinal, shouldShow, style} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo, hidePopup} = p
      return (shouldShow?.() ?? true) ? (
        <Chat.ChatProvider id={conversationIDKey}>
          <Kb.FloatingModalContext.Provider value="bottomsheet">
            <MessagePopup
              ordinal={ordinal}
              key="popup"
              attachTo={attachTo}
              onHidden={hidePopup}
              position="top right"
              style={style}
              visible={true}
            />
          </Kb.FloatingModalContext.Provider>
        </Chat.ChatProvider>
      ) : null
    },
    [ordinal, shouldShow, style, conversationIDKey]
  )
  return Kb.usePopup2(makePopup)
}
