import * as C from '../../../../constants'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import AttachmentMessage from './attachment'
import JourneycardMessage from './journeycard'
import TextMessage from './text'
import type * as T from '../../../../constants/types'

type Props = {
  ordinal: T.Chat.Ordinal
  attachTo?: React.RefObject<Kb.MeasureRef>
  onHidden: () => void
  position: Kb.Styles.Position
  style?: Kb.Styles.StylesCrossPlatform
  visible: boolean
}

const MessagePopup = React.memo(function MessagePopup(p: Props) {
  const {ordinal, attachTo, onHidden, position, style, visible} = p
  const type = C.useChatContext(s => s.messageMap.get(ordinal)?.type)
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
    default:
      return null
  }
})

export default MessagePopup

// Mobile only
type ModalProps = {
  // needed for page
  conversationIDKey: T.Chat.ConversationIDKey
  ordinal: T.Chat.Ordinal
}
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
  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup2(makePopup)
  if (!showingPopup) {
    setShowingPopup(true)
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
  const {ordinal, shouldShow, style} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {toggleShowingPopup, attachTo} = p
      return shouldShow?.() ?? true ? (
        <MessagePopup
          ordinal={ordinal}
          key="popup"
          attachTo={attachTo}
          onHidden={toggleShowingPopup}
          position="top right"
          style={style}
          visible={true}
        />
      ) : null
    },
    [ordinal, shouldShow, style]
  )
  const desktopPopup = Kb.usePopup2(makePopup)
  const navigateAppend = C.useChatNavigateAppend()
  const mobilePopup: {
    popup: React.ReactNode
    popupAnchor: React.RefObject<Kb.MeasureRef>
    setShowingPopup: React.Dispatch<React.SetStateAction<boolean>>
    showingPopup: boolean
    toggleShowingPopup: () => void
  } = {
    popup: null,
    popupAnchor: React.useRef<Kb.MeasureRef>(null),
    setShowingPopup: () => {},
    showingPopup: true,
    toggleShowingPopup: Container.useEvent(() => {
      navigateAppend(conversationIDKey => ({
        props: {conversationIDKey, ordinal},
        selected: 'chatMessagePopup',
      }))
    }),
  }

  return Kb.Styles.isMobile ? mobilePopup : desktopPopup
}
