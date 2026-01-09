import * as C from '@/constants'
import * as Chat from '@/stores/chat2'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {MessageContext, useOrdinal} from '../ids-context'
import EmojiRow from '../emoji-row'
import ExplodingHeightRetainer from './exploding-height-retainer/container'
import ExplodingMeta from './exploding-meta'
import LongPressable from './long-pressable'
import {useMessagePopup} from '../message-popup'
import ReactionsRow from '../reactions-rows'
import SendIndicator from './send-indicator'
import * as T from '@/constants/types'
import capitalize from 'lodash/capitalize'
import {useEdited} from './edited'
import {useCurrentUserState} from '@/stores/current-user'
// import {useDebugLayout} from '@/util/debug-react'

export type Props = {
  ordinal: T.Chat.Ordinal
}

const messageShowsPopup = (type?: T.Chat.Message['type']) =>
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
    'systemChangeAvatar',
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
const missingMessage = Chat.makeMessageDeleted({})

// Pure helper functions - moved outside hooks to avoid recreating them per message
const getReactionsPopupPosition = (
  ordinal: T.Chat.Ordinal,
  ordinals: ReadonlyArray<T.Chat.Ordinal>,
  hasReactions: boolean,
  message: T.Chat.Message
) => {
  if (C.isMobile) return 'none' as const
  if (hasReactions) return 'none' as const
  const validMessage = Chat.isMessageWithReactions(message)
  if (!validMessage) return 'none' as const
  return ordinals.at(-1) === ordinal ? ('last' as const) : ('middle' as const)
}

const getEcrType = (message: T.Chat.Message, you: string) => {
  const {errorReason, type, submitState} = message
  if (!errorReason) return EditCancelRetryType.NONE
  if (!you) return errorReason ? EditCancelRetryType.NOACTION : EditCancelRetryType.NONE
  if (message.type === 'text' && message.flipGameID) return EditCancelRetryType.NONE
  if ((type !== 'text' && type !== 'attachment') || (submitState !== 'pending' && submitState !== 'failed')) {
    return EditCancelRetryType.NOACTION
  }
  const {outboxID, errorTyp} = message
  if (!!outboxID && errorTyp === T.RPCChat.OutboxErrorType.toolong) return EditCancelRetryType.EDIT_CANCEL
  if (outboxID) {
    switch (errorTyp) {
      case T.RPCChat.OutboxErrorType.minwriter:
      case T.RPCChat.OutboxErrorType.restrictedbot:
        return EditCancelRetryType.CANCEL
      default:
    }
  }
  return EditCancelRetryType.RETRY_CANCEL
}

// Combined selector hook that fetches all message data in a single subscription
export const useMessageData = (ordinal: T.Chat.Ordinal) => {
  const you = useCurrentUserState(s => s.username)

  return Chat.useChatContext(
    C.useShallow(s => {
      const accountsInfoMap = s.accountsInfoMap
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const isEditing = s.editing === ordinal
      const ordinals = s.messageOrdinals
      const {exploded, submitState, author, id, botUsername} = m
      const type = m.type
      const idMatchesOrdinal = T.Chat.ordinalToNumber(m.ordinal) === T.Chat.messageIDToNumber(id)
      const youSent = m.author === you && !idMatchesOrdinal
      const exploding = !!m.exploding
      const decorate = !exploded && !m.errorReason
      const isShowingUploadProgressBar = you === author && m.type === 'attachment' && m.inlineVideoPlayable
      const showSendIndicator =
        !!submitState && !exploded && you === author && !idMatchesOrdinal && !isShowingUploadProgressBar
      const showRevoked = !!m.deviceRevokedAt
      const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
      const paymentStatusMap = Chat.useChatState.getState().paymentStatusMap
      const showCoinsIcon = hasSuccessfulInlinePayments(paymentStatusMap, m)
      const hasReactions = (m.reactions?.size ?? 0) > 0
      const botname = botUsername === author ? '' : (botUsername ?? '')
      const reactionsPopupPosition = getReactionsPopupPosition(ordinal, ordinals ?? [], hasReactions, m)
      const ecrType = getEcrType(m, you)
      const shouldShowPopup = Chat.shouldShowPopup(accountsInfoMap, m)
      // Inline highlight mode check to avoid separate selector
      const centeredOrdinalType = s.messageCenterOrdinal
      const showCenteredHighlight =
        centeredOrdinalType?.ordinal === ordinal && centeredOrdinalType.highlightMode !== 'none'

      return {
        botname,
        decorate,
        ecrType,
        exploding,
        hasReactions,
        isEditing,
        reactionsPopupPosition,
        shouldShowPopup,
        showCenteredHighlight,
        showCoinsIcon,
        showExplodingCountdown,
        showRevoked,
        showSendIndicator,
        type,
        you,
        youSent,
      }
    })
  )
}

// Version that accepts pre-fetched data to avoid duplicate selector calls
export const useCommonWithData = (ordinal: T.Chat.Ordinal, data: ReturnType<typeof useMessageData>) => {
  const {type, shouldShowPopup, showCenteredHighlight} = data

  const shouldShow = React.useCallback(() => {
    return messageShowsPopup(type) && shouldShowPopup
  }, [shouldShowPopup, type])
  const {showPopup, showingPopup, popup, popupAnchor} = useMessagePopup({
    ordinal,
    shouldShow,
    style: styles.messagePopupContainer,
  })
  return {popup, popupAnchor, showCenteredHighlight, showPopup, showingPopup, type}
}

// Legacy version for backward compatibility with other wrappers
export const useCommon = (ordinal: T.Chat.Ordinal) => {
  const data = useMessageData(ordinal)
  const {type, shouldShowPopup, showCenteredHighlight} = data

  const shouldShow = React.useCallback(() => {
    return messageShowsPopup(type) && shouldShowPopup
  }, [shouldShowPopup, type])
  const {showPopup, showingPopup, popup, popupAnchor} = useMessagePopup({
    ordinal,
    shouldShow,
    style: styles.messagePopupContainer,
  })
  return {popup, popupAnchor, showCenteredHighlight, showPopup, showingPopup, type}
}

type WMProps = {
  children: React.ReactNode
  bottomChildren?: React.ReactNode
  showCenteredHighlight: boolean
  showPopup: () => void
  showingPopup: boolean
  popup: React.ReactNode
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
  // Optional: if provided, avoids calling useMessageData again
  messageData?: ReturnType<typeof useMessageData>
} & Props

const successfulInlinePaymentStatuses = ['completed', 'claimable']
const hasSuccessfulInlinePayments = (
  paymentStatusMap: Chat.State['paymentStatusMap'],
  message: T.Chat.Message
): boolean => {
  if (message.type !== 'text' || !message.inlinePaymentIDs) {
    return false
  }
  return (
    message.inlinePaymentSuccessful ||
    message.inlinePaymentIDs.some(id => {
      const s = paymentStatusMap.get(id)
      return !!s && successfulInlinePaymentStatuses.includes(s.status)
    })
  )
}

type TSProps = {
  botname: string
  bottomChildren: React.ReactNode
  children: React.ReactNode
  decorate: boolean
  ecrType: EditCancelRetryType
  exploding: boolean
  hasReactions: boolean
  isHighlighted: boolean
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  setShowingPicker: (s: boolean) => void
  shouldShowPopup: boolean
  showCoinsIcon: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showSendIndicator: boolean
  showingPicker: boolean
  showingPopup: boolean
  showPopup: () => void
  type: T.Chat.MessageType
  you: string
}

const NormalWrapper = ({
  children,
  style,
}: {
  children: React.ReactNode
  style: Kb.Styles.StylesCrossPlatform
}) => {
  return (
    <Kb.Box2 direction="vertical" style={style} fullWidth={!Kb.Styles.isMobile}>
      {children}
    </Kb.Box2>
  )
}

const TextAndSiblings = React.memo(function TextAndSiblings(p: TSProps) {
  const {botname, bottomChildren, children, decorate, isHighlighted} = p
  const {showingPopup, ecrType, exploding, hasReactions, popupAnchor} = p
  const {type, reactionsPopupPosition, setShowingPicker, showCoinsIcon, shouldShowPopup} = p
  const {showPopup, showExplodingCountdown, showRevoked, showSendIndicator, showingPicker} = p
  const pressableProps = Kb.Styles.isMobile
    ? {
        onLongPress: decorate ? showPopup : undefined,
        style: isHighlighted ? {backgroundColor: Kb.Styles.globalColors.yellowOrYellowAlt} : undefined,
      }
    : {
        className: Kb.Styles.classNames({
          TextAndSiblings: true,
          systemMessage: type.startsWith('system'),
          // eslint-disable-next-line sort-keys
          active: showingPopup || showingPicker,
        }),
        onContextMenu: showPopup,
      }

  const content = exploding ? (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <ExplodingHeightRetainer>{children as React.ReactElement}</ExplodingHeightRetainer>
    </Kb.Box2>
  ) : (
    children
  )

  // uncomment to debug sizing issues
  // const dump = Container.useEvent(() => p)
  // const debugLayout = useDebugLayout()
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
      <Kb.Box2 direction="vertical" style={styles.middle} fullWidth={!Kb.Styles.isMobile}>
        <NormalWrapper style={styles.background}>
          {content}
          <BottomSide
            ecrType={ecrType}
            reactionsPopupPosition={reactionsPopupPosition}
            hasReactions={hasReactions}
            bottomChildren={bottomChildren}
            showPopup={showPopup}
            setShowingPicker={setShowingPicker}
            showingPopup={showingPopup}
          />
        </NormalWrapper>
      </Kb.Box2>
      <RightSide
        shouldShowPopup={shouldShowPopup}
        botname={botname}
        showSendIndicator={showSendIndicator}
        showExplodingCountdown={showExplodingCountdown}
        showRevoked={showRevoked}
        showCoinsIcon={showCoinsIcon}
        showPopup={showPopup}
        popupAnchor={popupAnchor}
      />
    </LongPressable>
  )
})

// Author
enum EditCancelRetryType {
  NONE,
  NOACTION,
  CANCEL,
  EDIT_CANCEL,
  RETRY_CANCEL,
}
const EditCancelRetry = React.memo(function EditCancelRetry(p: {ecrType: EditCancelRetryType}) {
  const {ecrType} = p
  const ordinal = useOrdinal()
  const {failureDescription, outboxID, exploding, messageDelete, messageRetry, setEditing} = Chat.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const outboxID = m?.outboxID
      const reason = m?.errorReason ?? ''
      const exploding = m?.exploding ?? false
      const failureDescription =
        ecrType === EditCancelRetryType.NOACTION
          ? reason
          : `This message failed to send${reason ? '. ' : ''}${capitalize(reason)}`
      const {messageDelete, messageRetry, setEditing} = s.dispatch
      return {
        exploding,
        failureDescription,
        messageDelete,
        messageRetry,
        outboxID,
        setEditing,
      }
    })
  )
  const onCancel = React.useCallback(() => {
    messageDelete(ordinal)
  }, [messageDelete, ordinal])
  const onEdit = React.useCallback(() => {
    setEditing(ordinal)
  }, [setEditing, ordinal])
  const onRetry = React.useCallback(() => {
    outboxID && messageRetry(outboxID)
  }, [messageRetry, outboxID])

  const cancel =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onCancel} virtualText={true}>
        Cancel
      </Kb.Text>
    ) : null

  const or =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text type="BodySmall" virtualText={true}>
        {' or '}
      </Kb.Text>
    ) : null

  const action: React.ReactNode =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text
        type="BodySmall"
        style={styles.failUnderline}
        onClick={ecrType === EditCancelRetryType.EDIT_CANCEL ? onEdit : onRetry}
        virtualText={true}
      >
        {ecrType === EditCancelRetryType.EDIT_CANCEL ? 'Edit' : 'Retry'}
      </Kb.Text>
    ) : null

  return (
    <Kb.Text key="isFailed" type="BodySmall">
      <Kb.Text type="BodySmall" style={exploding ? styles.failExploding : styles.fail}>
        {exploding ? (
          <>
            <Kb.Icon fontSize={16} boxStyle={styles.failExplodingIcon} type="iconfont-block" />{' '}
          </>
        ) : null}
        {`${failureDescription}. `}
      </Kb.Text>
      {action}
      {or}
      {cancel}
    </Kb.Text>
  )
})

type BProps = {
  showPopup: () => void
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

  // this exists and is shown using css to avoid thrashing
  const desktopReactionsPopup =
    !C.isMobile && reactionsPopupPosition !== 'none' && !showingPopup ? (
      <EmojiRow
        className={Kb.Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
        onShowingEmojiPicker={setShowingPicker}
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
      {desktopReactionsPopup}
    </>
  )
})

// Exploding, ... , sending, tombstone
type RProps = {
  showPopup: () => void
  showSendIndicator: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showCoinsIcon: boolean
  botname: string
  shouldShowPopup: boolean
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
}
const RightSide = React.memo(function RightSide(p: RProps) {
  const {showPopup, showSendIndicator, showCoinsIcon, popupAnchor} = p
  const {showExplodingCountdown, showRevoked, botname, shouldShowPopup} = p
  const sendIndicator = showSendIndicator ? <SendIndicator /> : null

  const explodingCountdown = showExplodingCountdown ? <ExplodingMeta onClick={showPopup} /> : null

  const revokedIcon = showRevoked ? (
    <Kb.Box2 direction="vertical" tooltip="Revoked device" className="tooltip-bottom-left">
      <Kb.Icon type="iconfont-rip" color={Kb.Styles.globalColors.black_35} />
    </Kb.Box2>
  ) : null

  const coinsIcon = showCoinsIcon ? <Kb.Icon type="icon-stellar-coins-stacked-16" /> : null

  const bot = botname ? (
    <Kb.Box2 direction="vertical" tooltip={`Encrypted for @${botname}`} className="tooltip-bottom-left">
      <Kb.Icon color={Kb.Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.Box2>
  ) : null

  const hasVisibleItems = !!explodingCountdown || !!revokedIcon || !!coinsIcon || !!bot

  // On mobile there is no ... menu
  // On Desktop we float the menu on top, if there are no items
  // if there are items we show them. We want the ... to take space but not be visible, so we move it to the
  // left, then on hover we invert the list so its on the right. Theres usually only 1 non menu item so this
  // is fine

  const menu =
    C.isMobile || !shouldShowPopup ? null : (
      <Kb.Box2
        direction="vertical"
        tooltip="More actions..."
        className={Kb.Styles.classNames(
          hasVisibleItems ? 'hover-opacity-full' : 'hover-visible',
          'tooltip-left'
        )}
      >
        <Kb.Box style={styles.ellipsis}>
          <Kb.Icon type="iconfont-ellipsis" onClick={showPopup} />
        </Kb.Box>
      </Kb.Box2>
    )

  const visibleItems =
    hasVisibleItems || menu ? (
      <Kb.Box2Measure
        direction="horizontal"
        alignSelf="flex-start"
        style={hasVisibleItems ? styles.rightSideItems : styles.rightSide}
        gap="tiny"
        className={Kb.Styles.classNames({
          'hover-reverse-row': hasVisibleItems && menu,
          'hover-visible': !hasVisibleItems && menu,
        })}
        ref={popupAnchor}
      >
        {menu}
        {explodingCountdown}
        {revokedIcon}
        {coinsIcon}
        {bot}
      </Kb.Box2Measure>
    ) : null

  return (
    <>
      {visibleItems}
      {sendIndicator}
    </>
  )
})

export const WrapperMessage = React.memo(function WrapperMessage(p: WMProps) {
  const {ordinal, bottomChildren, children, messageData: mdataProp} = p
  const {showCenteredHighlight, showPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)

  // Use provided messageData if available, otherwise fetch it
  const mdataFetched = useMessageData(ordinal)
  const mdata = mdataProp ?? mdataFetched

  const {decorate, type, hasReactions, isEditing, shouldShowPopup} = mdata
  const {ecrType, showSendIndicator, showRevoked, showExplodingCountdown, exploding} = mdata
  const {reactionsPopupPosition, showCoinsIcon, botname, you} = mdata

  const canFixOverdraw = !showCenteredHighlight && !isEditing

  const isHighlighted = showCenteredHighlight || isEditing
  const tsprops = {
    botname,
    bottomChildren,
    children,
    decorate,
    ecrType,
    exploding,
    hasReactions,
    isHighlighted,
    popupAnchor,
    reactionsPopupPosition,
    setShowingPicker,
    shouldShowPopup,
    showCoinsIcon,
    showExplodingCountdown,
    showPopup,
    showRevoked,
    showSendIndicator,
    showingPicker,
    showingPopup,
    type,
    you,
  }

  const messageContext = React.useMemo(
    () => ({canFixOverdraw, isHighlighted: showCenteredHighlight, ordinal}),
    [ordinal, showCenteredHighlight, canFixOverdraw]
  )

  return (
    <MessageContext.Provider value={messageContext}>
      <Kb.Styles.CanFixOverdrawContext.Provider value={canFixOverdraw}>
        <TextAndSiblings {...tsprops} />
        {popup}
      </Kb.Styles.CanFixOverdrawContext.Provider>
    </MessageContext.Provider>
  )
})

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      background: {
        alignSelf: 'stretch',
        flexGrow: 1,
        flexShrink: 1,
        position: 'relative',
      },
      ellipsis: Kb.Styles.platformStyles({
        isElectron: {paddingTop: 2},
        isMobile: {paddingTop: 4},
      }),
      emojiRow: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          border: `1px solid ${Kb.Styles.globalColors.black_10}`,
          borderRadius: Kb.Styles.borderRadius,
          bottom: -Kb.Styles.globalMargins.medium + 3,
          paddingRight: Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          zIndex: 2,
        },
      }),
      emojiRowLast: Kb.Styles.platformStyles({
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white,
          border: `1px solid ${Kb.Styles.globalColors.black_10}`,
          borderRadius: Kb.Styles.borderRadius,
          paddingRight: Kb.Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          top: -Kb.Styles.globalMargins.medium + 5,
          zIndex: 2,
        },
      }),
      fail: {color: Kb.Styles.globalColors.redDark},
      failExploding: {color: Kb.Styles.globalColors.black_50},
      failExplodingIcon: Kb.Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          verticalAlign: 'middle',
        },
      }),
      failUnderline: {color: Kb.Styles.globalColors.redDark, textDecorationLine: 'underline'},
      highlighted: {
        backgroundColor: Kb.Styles.globalColors.yellowOrYellowAlt,
      },
      menuButtons: Kb.Styles.platformStyles({
        common: {
          alignSelf: 'flex-start',
          flexShrink: 0,
          justifyContent: 'flex-end',
          overflow: 'hidden',
        },
        isElectron: {height: 20},
        isMobile: {height: 24},
      }),
      messagePopupContainer: {marginRight: Kb.Styles.globalMargins.small},
      middle: {
        flexGrow: 1,
        flexShrink: 1,
        paddingLeft: Kb.Styles.isMobile ? 48 : 56,
        paddingRight: 4,
        position: 'relative',
      },
      moreActionsTooltip: {marginRight: -Kb.Styles.globalMargins.xxtiny},
      paddingLeftTiny: {paddingLeft: Kb.Styles.globalMargins.tiny},
      rightSide: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          minHeight: 20,
          paddingLeft: Kb.Styles.globalMargins.tiny,
          paddingRight: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {
          backgroundColor: Kb.Styles.globalColors.white_90,
          minHeight: 14,
          position: 'absolute',
          right: 16,
          top: 4,
        },
      }),
      rightSideItems: Kb.Styles.platformStyles({
        common: {
          borderRadius: Kb.Styles.borderRadius,
          minHeight: 20,
          paddingLeft: Kb.Styles.globalMargins.tiny,
        },
        isElectron: {minHeight: 14},
      }),
      sendIndicatorPlaceholder: {
        height: 20,
        width: 20,
      },
      timestamp: Kb.Styles.platformStyles({
        isElectron: {
          flexShrink: 0,
          lineHeight: 19,
        },
      }),
    }) as const
)
