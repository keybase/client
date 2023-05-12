import * as Container from '../../../../util/container'
import * as Constants from '../../../../constants/chat2'
import * as RouteTreeGen from '../../../../actions/route-tree-gen'
import * as Kb from '../../../../common-adapters'
import * as Styles from '../../../../styles'
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

// Mobile only
type ModalProps = Container.RouteProps2<'chatMessagePopup'>
export const MessagePopupModal = (p: ModalProps) => {
  const {conversationIDKey, ordinal} = p.route.params
  const pop = p.navigation.pop
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {attachTo} = p
      return (
        <Kb.FloatingModalContext.Provider value={true}>
          <MessagePopup
            conversationIDKey={conversationIDKey}
            ordinal={ordinal}
            key="popup"
            attachTo={attachTo}
            onHidden={pop}
            position="top right"
            visible={true}
          />
        </Kb.FloatingModalContext.Provider>
      )
    },
    [conversationIDKey, ordinal, pop]
  )
  const {popup, popupAnchor, setShowingPopup, showingPopup} = Kb.usePopup2(makePopup)
  if (!showingPopup) {
    setShowingPopup(true)
  }

  return (
    <Kb.Box2 direction="vertical" fullWidth={true} fullHeight={true} ref={popupAnchor as any}>
      {popup}
    </Kb.Box2>
  )
}

export const useMessagePopup = (p: {
  conversationIDKey: Types.ConversationIDKey
  ordinal: Types.Ordinal
  shouldShow?: () => boolean
  style?: Styles.StylesCrossPlatform
}) => {
  const {conversationIDKey, ordinal, shouldShow, style} = p
  const makePopup = React.useCallback(
    (p: Kb.Popup2Parms) => {
      const {toggleShowingPopup, attachTo} = p
      return shouldShow?.() ?? true ? (
        <MessagePopup
          conversationIDKey={conversationIDKey}
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
    [conversationIDKey, ordinal, shouldShow, style]
  )

  const desktopPopup = Kb.usePopup2(makePopup)
  const dispatch = Container.useDispatch()

  const mobilePopup: {
    popup: React.ReactNode
    popupAnchor: React.MutableRefObject<React.Component | null>
    setShowingPopup: React.Dispatch<React.SetStateAction<boolean>>
    showingPopup: boolean
    toggleShowingPopup: () => void
  } = {
    popup: null,
    popupAnchor: React.useRef<React.Component>(null),
    setShowingPopup: () => {},
    showingPopup: true,
    toggleShowingPopup: Container.useEvent(() => {
      dispatch(
        RouteTreeGen.createNavigateAppend({
          path: [{props: {conversationIDKey, ordinal}, selected: 'chatMessagePopup'}],
        })
      )
    }),
  }

  return Styles.isMobile ? mobilePopup : desktopPopup
}
