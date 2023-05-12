import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import shallowEqual from 'shallowequal'
import {ConvoIDContext, OrdinalContext, GetIdsContext, HighlightedContext} from '../ids-context'
import EmojiRow from '../emoji-row/container'
import ExplodingHeightRetainer from './exploding-height-retainer/container'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import {useMessagePopup} from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import ReactionsRow from '../reactions-row'
import SendIndicator from './send-indicator'
import type * as Types from '../../../../constants/types/chat2'
import capitalize from 'lodash/capitalize'
import {useEdited} from './edited'
// import {useDebugLayout} from '../../../../util/debug'

export type Props = {
  ordinal: Types.Ordinal
}

const messageShowsPopup = (type?: Types.Message['type']) =>
  !!type &&
  [
    'text',
    'attachment',
    'sendPayment',
    'requestPayment',
    'setChannelname',
    'setDescription',
    'pin',
    'systemAddedToTeam',
    'systemChangeRetention',
    'systemGitPush',
    'systemInviteAccepted',
    'systemSimpleToComplex',
    'systemSBSResolved',
    'systemText',
    'systemUsersAddedToConversation',
    'systemNewChannel',
    'journeycard',
  ].includes(type)

// If there is no matching message treat it like a deleted
const missingMessage = Constants.makeMessageDeleted({})

export const useCommon = (ordinal: Types.Ordinal) => {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const showCenteredHighlight = useHighlightMode(conversationIDKey, ordinal)

  const {type, shouldShowPopup} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const type = m?.type
    const shouldShowPopup = Constants.shouldShowPopup(state, m ?? undefined)
    return {shouldShowPopup, type}
  }, shallowEqual)

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = useMessagePopup({
    conversationIDKey,
    ordinal,
    shouldShow: () => messageShowsPopup(type) && shouldShowPopup && showingPopup,
    style: styles.messagePopupContainer,
  })
  return {popup, popupAnchor, showCenteredHighlight, showingPopup, toggleShowingPopup, type}
}

type WMProps = {
  children: React.ReactNode
  bottomChildren?: React.ReactNode
  showCenteredHighlight: boolean
  toggleShowingPopup: () => void
  showingPopup: boolean
  popup: React.ReactNode
  popupAnchor: React.MutableRefObject<React.Component | null>
} & Props

const useRedux = (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) => {
  const getReactionsPopupPosition = (
    hasReactions: boolean,
    message: Types.Message,
    state: Container.TypedState
  ) => {
    if (Container.isMobile) return 'none' as const
    if (hasReactions) {
      return 'none' as const
    }
    const validMessage = message && Constants.isMessageWithReactions(message)
    if (!validMessage) return 'none' as const

    const ordinals = Constants.getMessageOrdinals(state, message.conversationIDKey)
    return ordinals[ordinals.length - 1] === ordinal ? ('last' as const) : ('middle' as const)
  }

  const getEcrType = (message: Types.Message, you: string) => {
    if (!message || !you) {
      return EditCancelRetryType.NONE
    }
    const {errorReason, type, submitState} = message
    if (
      !errorReason ||
      (type !== 'text' && type !== 'attachment') ||
      (submitState !== 'pending' && submitState !== 'failed') ||
      (message.type === 'text' && message.flipGameID)
    ) {
      return EditCancelRetryType.NONE
    }

    const {outboxID, errorTyp} = message
    if (!!outboxID && errorTyp === RPCChatTypes.OutboxErrorType.toolong) {
      return EditCancelRetryType.EDIT_CANCEL
    }
    if (outboxID) {
      switch (errorTyp) {
        case RPCChatTypes.OutboxErrorType.minwriter:
        case RPCChatTypes.OutboxErrorType.restrictedbot:
          return EditCancelRetryType.CANCEL
      }
    }
    return EditCancelRetryType.RETRY_CANCEL
  }

  return Container.useSelector(state => {
    const you = state.config.username
    const m = Constants.getMessage(state, conversationIDKey, ordinal) ?? missingMessage
    const {exploded, submitState, author, id, botUsername} = m
    const exploding = !!m.exploding
    const isPendingPayment = Constants.isPendingPaymentMessage(state, m)
    const decorate = !exploded && !m.errorReason
    const type = m.type
    const isEditing = state.chat2.editingMap.get(conversationIDKey) === ordinal
    const isShowingUploadProgressBar = you === author && m.type === 'attachment' && m.inlineVideoPlayable
    const showSendIndicator =
      !!submitState && !exploded && you === author && id !== ordinal && !isShowingUploadProgressBar
    const showRevoked = !!m?.deviceRevokedAt
    const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
    const showCoinsIcon = Constants.hasSuccessfulInlinePayments(state, m)
    const hasReactions = (m.reactions?.size ?? 0) > 0
    // hide if the bot is writing to itself
    const botname = botUsername === author ? '' : botUsername ?? ''
    const reactionsPopupPosition = getReactionsPopupPosition(hasReactions, m, state)
    const ecrType = getEcrType(m, you)
    return {
      botname,
      decorate,
      ecrType,
      exploding,
      hasReactions,
      isEditing,
      isPendingPayment,
      reactionsPopupPosition,
      showCoinsIcon,
      showExplodingCountdown,
      showRevoked,
      showSendIndicator,
      type,
      you,
    }
  }, shallowEqual)
}

type TSProps = {
  botname: string
  bottomChildren: React.ReactNode
  children: React.ReactNode
  decorate: boolean
  ecrType: EditCancelRetryType
  exploding: boolean
  hasReactions: boolean
  isPendingPayment: boolean
  isHighlighted: boolean
  popupAnchor: React.MutableRefObject<React.Component | null>
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  setShowingPicker: (s: boolean) => void
  showCoinsIcon: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showSendIndicator: boolean
  showingPicker: boolean
  showingPopup: boolean
  toggleShowingPopup: () => void
  type: Types.MessageType
  you: string
}

const NormalWrapper = ({children, style}: {children: React.ReactNode; style: Styles.StylesCrossPlatform}) => {
  return (
    <Kb.Box2 direction="vertical" style={style} fullWidth={!Styles.isMobile}>
      {children}
    </Kb.Box2>
  )
}

const TextAndSiblings = React.memo(function TextAndSiblings(p: TSProps) {
  const {botname, bottomChildren, children, decorate, isHighlighted} = p
  const {showingPopup, ecrType, exploding, hasReactions, isPendingPayment, popupAnchor} = p
  const {type, reactionsPopupPosition, setShowingPicker, showCoinsIcon} = p
  const {toggleShowingPopup, showExplodingCountdown, showRevoked, showSendIndicator, showingPicker} = p
  const pressableProps = Styles.isMobile
    ? {
        onLongPress: decorate ? toggleShowingPopup : undefined,
        style: isHighlighted ? {backgroundColor: Styles.globalColors.yellowOrYellowAlt} : undefined,
      }
    : {
        className: Styles.classNames({
          TextAndSiblings: true,
          noOverflow: isPendingPayment,
          systemMessage: type?.startsWith('system'),
          // eslint-disable-next-line
          active: showingPopup || showingPicker,
        }),
        onContextMenu: toggleShowingPopup,
        // attach popups to the message itself
        ref: popupAnchor as any,
      }

  const Background = isPendingPayment ? PendingPaymentBackground : NormalWrapper

  let content = exploding ? (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <ExplodingHeightRetainer>{children}</ExplodingHeightRetainer>
    </Kb.Box2>
  ) : (
    children
  )

  // uncomment to debug sizing issues
  // const dump = Container.useEvent(() => p)
  // const debugLayout = useDebugLayout(dump)
  // content = (
  //   <Kb.Box2
  //     key="TEMP"
  //     direction="vertical"
  //     onLayout={debugLayout}
  //     alignItems="flex-start"
  //     alignSelf="flex-start"
  //   >
  //     {content}
  //   </Kb.Box2>
  // )

  return (
    <LongPressable {...pressableProps}>
      <Kb.Box2 direction="vertical" style={styles.middle} fullWidth={!Styles.isMobile}>
        <Background style={styles.background}>
          {content}
          <BottomSide
            ecrType={ecrType}
            reactionsPopupPosition={reactionsPopupPosition}
            hasReactions={hasReactions}
            bottomChildren={bottomChildren}
            toggleShowingPopup={toggleShowingPopup}
            setShowingPicker={setShowingPicker}
            showingPopup={showingPopup}
          />
        </Background>
      </Kb.Box2>
      <RightSide
        botname={botname}
        showSendIndicator={showSendIndicator}
        showExplodingCountdown={showExplodingCountdown}
        showRevoked={showRevoked}
        showCoinsIcon={showCoinsIcon}
        toggleShowingPopup={toggleShowingPopup}
      />
    </LongPressable>
  )
})

const useHighlightMode = (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) => {
  const centeredOrdinalType = Container.useSelector(state => {
    const i = state.chat2.messageCenterOrdinals.get(conversationIDKey)
    return i?.ordinal === ordinal ? i.highlightMode : undefined
  })

  return centeredOrdinalType !== undefined
}

// Author
enum EditCancelRetryType {
  NONE,
  CANCEL,
  EDIT_CANCEL,
  RETRY_CANCEL,
}
const EditCancelRetry = React.memo(function EditCancelRetry(p: {ecrType: EditCancelRetryType}) {
  const {ecrType} = p
  const conversationIDKey = React.useContext(ConvoIDContext)
  const ordinal = React.useContext(OrdinalContext)
  const {failureDescription, outboxID} = Container.useSelector(state => {
    const m = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const outboxID = m?.outboxID
    const reason = m?.errorReason ?? ''
    const failureDescription = `This messge failed to send${reason ? '. ' : ''}${capitalize(reason)}`
    return {failureDescription, outboxID}
  }, shallowEqual)
  const dispatch = Container.useDispatch()
  const onCancel = React.useCallback(() => {
    dispatch(Chat2Gen.createMessageDelete({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])
  const onEdit = React.useCallback(() => {
    dispatch(Chat2Gen.createMessageSetEditing({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])
  const onRetry = React.useCallback(() => {
    outboxID && dispatch(Chat2Gen.createMessageRetry({conversationIDKey, outboxID}))
  }, [dispatch, conversationIDKey, outboxID])

  const cancel = (
    <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onCancel}>
      Cancel
    </Kb.Text>
  )

  const or =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text type="BodySmall"> or </Kb.Text>
    ) : null

  let action: React.ReactNode =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text
        type="BodySmall"
        style={styles.failUnderline}
        onClick={ecrType === EditCancelRetryType.EDIT_CANCEL ? onEdit : onRetry}
      >
        {ecrType === EditCancelRetryType.EDIT_CANCEL ? 'Edit' : 'Retry'}
      </Kb.Text>
    ) : null

  return (
    <Kb.Text key="isFailed" type="BodySmall">
      <Kb.Text type="BodySmall" style={styles.fail}>
        {failureDescription}.{' '}
      </Kb.Text>
      {action}
      {or}
      {cancel}
    </Kb.Text>
  )
})

type BProps = {
  toggleShowingPopup: () => void
  showingPopup: boolean
  setShowingPicker: (s: boolean) => void
  bottomChildren?: React.ReactNode
  hasReactions: boolean
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  ecrType: EditCancelRetryType
}
// reactions
const BottomSide = React.memo(function BottomSide(p: BProps) {
  const {showingPopup, setShowingPicker, bottomChildren, ecrType} = p
  const {hasReactions, reactionsPopupPosition} = p

  const reactionsRow = hasReactions ? <ReactionsRow /> : null

  const reactionsPopup =
    !Container.isMobile && reactionsPopupPosition !== 'none' && !showingPopup ? (
      <EmojiRow
        className={Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
        onShowingEmojiPicker={setShowingPicker}
        tooltipPosition={reactionsPopupPosition === 'middle' ? 'top center' : 'bottom center'}
        style={reactionsPopupPosition === 'last' ? styles.emojiRowLast : styles.emojiRow}
      />
    ) : null

  const edited = useEdited()

  return (
    <>
      {edited}
      {bottomChildren ?? null}
      {ecrType !== EditCancelRetryType.NONE ? <EditCancelRetry ecrType={ecrType} /> : null}
      {reactionsRow}
      {reactionsPopup}
    </>
  )
})

// Exploding, ... , sending, tombstone
type RProps = {
  toggleShowingPopup: () => void
  showSendIndicator: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showCoinsIcon: boolean
  botname: string
}
const RightSide = React.memo(function RightSide(p: RProps) {
  const {toggleShowingPopup, showSendIndicator, showCoinsIcon} = p
  const {showExplodingCountdown, showRevoked, botname} = p
  const sendIndicator = showSendIndicator ? <SendIndicator /> : null

  const explodingCountdown = showExplodingCountdown ? <ExplodingMeta onClick={toggleShowingPopup} /> : null

  const revokedIcon = showRevoked ? (
    <Kb.WithTooltip tooltip="Revoked device">
      <Kb.Icon type="iconfont-rip" color={Styles.globalColors.black_35} />
    </Kb.WithTooltip>
  ) : null

  const coinsIcon = showCoinsIcon ? <Kb.Icon type="icon-stellar-coins-stacked-16" /> : null

  const bot = botname ? (
    <Kb.WithTooltip tooltip={`Encrypted for @${botname}`}>
      <Kb.Icon color={Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.WithTooltip>
  ) : null

  const hasVisibleItems = !!explodingCountdown || !!revokedIcon || !!coinsIcon || !!bot

  // On mobile there is no ... menu
  // On Desktop we float the menu on top, if there are no items
  // if there are items we show them. We want the ... to take space but not be visible, so we move it to the
  // left, then on hover we invert the list so its on the right. Theres usually only 1 non menu item so this
  // is fine

  const menu = Container.isMobile ? null : (
    <Kb.WithTooltip
      tooltip="More actions..."
      toastStyle={styles.moreActionsTooltip}
      className={hasVisibleItems ? 'hover-opacity-full' : 'hover-visible'}
    >
      <Kb.Box style={styles.ellipsis}>
        <Kb.Icon type="iconfont-ellipsis" onClick={toggleShowingPopup} />
      </Kb.Box>
    </Kb.WithTooltip>
  )

  const visibleItems =
    hasVisibleItems || menu ? (
      <Kb.Box2
        direction="horizontal"
        alignSelf="flex-start"
        style={hasVisibleItems ? styles.rightSideItems : styles.rightSide}
        gap="tiny"
        className={Styles.classNames({
          'hover-reverse-row': hasVisibleItems && menu,
          'hover-visible': !hasVisibleItems && menu,
        })}
      >
        {menu}
        {explodingCountdown}
        {revokedIcon}
        {coinsIcon}
        {bot}
      </Kb.Box2>
    ) : null

  return (
    <>
      {visibleItems}
      {sendIndicator}
    </>
  )
})

export const WrapperMessage = React.memo(function WrapperMessage(p: WMProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {ordinal, bottomChildren, children} = p

  // passed in context so stable
  const conversationIDKeyRef = React.useRef(conversationIDKey)
  const ordinalRef = React.useRef(ordinal)

  React.useEffect(() => {
    conversationIDKeyRef.current = conversationIDKey
    ordinalRef.current = ordinal
  }, [conversationIDKey, ordinal])
  const getIds = React.useCallback(() => {
    return {conversationIDKey: conversationIDKeyRef.current, ordinal: ordinalRef.current}
  }, [])

  const {showCenteredHighlight, toggleShowingPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)

  const mdata = useRedux(conversationIDKey, ordinal)

  const {isPendingPayment, decorate, type, hasReactions, isEditing} = mdata
  const {ecrType, showSendIndicator, showRevoked, showExplodingCountdown, exploding} = mdata
  const {reactionsPopupPosition, showCoinsIcon, botname, you} = mdata

  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight && !isEditing

  const tsprops = {
    botname,
    bottomChildren,
    children,
    decorate,
    ecrType,
    exploding,
    hasReactions,
    isHighlighted: showCenteredHighlight || isEditing,
    isPendingPayment,
    popupAnchor,
    reactionsPopupPosition,
    setShowingPicker,
    showCoinsIcon,
    showExplodingCountdown,
    showRevoked,
    showSendIndicator,
    showingPicker,
    showingPopup,
    toggleShowingPopup,
    type,
    you,
  }

  return (
    <GetIdsContext.Provider value={getIds}>
      <OrdinalContext.Provider value={ordinal}>
        <HighlightedContext.Provider value={showCenteredHighlight}>
          <Styles.CanFixOverdrawContext.Provider value={canFixOverdraw}>
            <TextAndSiblings {...tsprops} />
            {popup}
          </Styles.CanFixOverdrawContext.Provider>
        </HighlightedContext.Provider>
      </OrdinalContext.Provider>
    </GetIdsContext.Provider>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      background: {
        alignSelf: 'stretch',
        flexGrow: 1,
        flexShrink: 1,
        position: 'relative',
      },
      ellipsis: Styles.platformStyles({
        isElectron: {height: 4, paddingTop: 0},
        isMobile: {paddingTop: 4},
      }),
      emojiRow: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          border: `1px solid ${Styles.globalColors.black_10}`,
          borderRadius: Styles.borderRadius,
          bottom: -Styles.globalMargins.medium + 3,
          paddingRight: Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          zIndex: 2,
        },
      }),
      emojiRowLast: Styles.platformStyles({
        isElectron: {
          backgroundColor: Styles.globalColors.white,
          border: `1px solid ${Styles.globalColors.black_10}`,
          borderRadius: Styles.borderRadius,
          bottom: -Styles.globalMargins.medium + 3,
          paddingRight: Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          top: -Styles.globalMargins.medium + 5,
          zIndex: 2,
        },
      }),
      fail: {color: Styles.globalColors.redDark},
      failExploding: {color: Styles.globalColors.black_50},
      failExplodingIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          verticalAlign: 'middle',
        },
      }),
      failUnderline: {color: Styles.globalColors.redDark, textDecorationLine: 'underline'},
      highlighted: {
        backgroundColor: Styles.globalColors.yellowOrYellowAlt,
      },
      menuButtons: Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flexShrink: 0,
          justifyContent: 'flex-end',
          overflow: 'hidden',
        },
        isElectron: {height: 20},
        isMobile: {height: 24},
      }),
      messagePopupContainer: {marginRight: Styles.globalMargins.small},
      middle: {
        flexGrow: 1,
        flexShrink: 1,
        paddingLeft: Styles.isMobile ? 48 : 56,
        paddingRight: 4,
        position: 'relative',
      },
      moreActionsTooltip: {marginRight: -Styles.globalMargins.xxtiny},
      paddingLeftTiny: {paddingLeft: Styles.globalMargins.tiny},
      rightSide: Styles.platformStyles({
        common: {
          borderRadius: Styles.borderRadius,
          minHeight: 20,
          paddingLeft: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.tiny,
        },
        isElectron: {
          backgroundColor: Styles.globalColors.white_90,
          minHeight: 14,
          position: 'absolute',
          right: 16,
          top: 4,
        },
      }),
      rightSideItems: Styles.platformStyles({
        common: {
          borderRadius: Styles.borderRadius,
          minHeight: 20,
          paddingLeft: Styles.globalMargins.tiny,
        },
        isElectron: {minHeight: 14},
      }),
      sendIndicatorPlaceholder: {
        height: 20,
        width: 20,
      },
      timestamp: Styles.platformStyles({
        isElectron: {
          flexShrink: 0,
          lineHeight: 19,
        },
      }),
    } as const)
)
