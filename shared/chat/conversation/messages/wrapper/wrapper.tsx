import * as C from '../../../../constants'
import * as Constants from '../../../../constants/chat2'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import {OrdinalContext, HighlightedContext} from '../ids-context'
import EmojiRow from '../emoji-row/container'
import ExplodingHeightRetainer from './exploding-height-retainer/container'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import {useMessagePopup} from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import ReactionsRow from '../reactions-row'
import SendIndicator from './send-indicator'
import * as T from '../../../../constants/types'
import capitalize from 'lodash/capitalize'
import {useEdited} from './edited'
import {Sent} from './sent'
// import {useDebugLayout} from '../../../../util/debug'

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

export const useCommon = (ordinal: T.Chat.Ordinal) => {
  const showCenteredHighlight = useHighlightMode(ordinal)

  const accountsInfoMap = C.useChatContext(s => s.accountsInfoMap)
  const {type, shouldShowPopup} = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const type = m?.type
      const shouldShowPopup = Constants.shouldShowPopup(accountsInfoMap, m ?? undefined)
      return {shouldShowPopup, type}
    })
  )

  const shouldShow = React.useCallback(() => {
    return messageShowsPopup(type) && shouldShowPopup
  }, [shouldShowPopup, type])
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = useMessagePopup({
    ordinal,
    shouldShow,
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
  popupAnchor: React.RefObject<Kb.MeasureRef>
} & Props

const successfulInlinePaymentStatuses = ['completed', 'claimable']
const hasSuccessfulInlinePayments = (
  paymentStatusMap: Constants.State['paymentStatusMap'],
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

const useRedux = (ordinal: T.Chat.Ordinal) => {
  const getReactionsPopupPosition = (
    ordinals: Array<T.Chat.Ordinal>,
    hasReactions: boolean,
    message: T.Chat.Message
  ) => {
    if (C.isMobile) return 'none' as const
    if (hasReactions) {
      return 'none' as const
    }
    const validMessage = Constants.isMessageWithReactions(message)
    if (!validMessage) return 'none' as const

    return ordinals.at(-1) === ordinal ? ('last' as const) : ('middle' as const)
  }

  const getEcrType = (message: T.Chat.Message, you: string) => {
    if (!you) {
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
    if (!!outboxID && errorTyp === T.RPCChat.OutboxErrorType.toolong) {
      return EditCancelRetryType.EDIT_CANCEL
    }
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

  const you = C.useCurrentUserState(s => s.username)
  const paymentStatusMap = C.useChatState(s => s.paymentStatusMap)
  const accountsInfoMap = C.useChatContext(s => s.accountsInfoMap)
  const ordinals = C.useChatContext(s => s.messageOrdinals)
  const isEditing = C.useChatContext(s => s.editing === ordinal)
  const d = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const {exploded, submitState, author, id, botUsername} = m
      const youSent = m.author === you && m.ordinal !== m.id
      const exploding = !!m.exploding
      const isPendingPayment = Constants.isPendingPaymentMessage(accountsInfoMap, m)
      const decorate = !exploded && !m.errorReason
      const type = m.type
      const isShowingUploadProgressBar = you === author && m.type === 'attachment' && m.inlineVideoPlayable
      const showSendIndicator =
        !!submitState && !exploded && you === author && id !== ordinal && !isShowingUploadProgressBar
      const showRevoked = !!m.deviceRevokedAt
      const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
      const showCoinsIcon = hasSuccessfulInlinePayments(paymentStatusMap, m)
      const hasReactions = (m.reactions?.size ?? 0) > 0
      // hide if the bot is writing to itself
      const botname = botUsername === author ? '' : botUsername ?? ''
      const reactionsPopupPosition = getReactionsPopupPosition(ordinals ?? [], hasReactions, m)
      const ecrType = getEcrType(m, you)
      return {
        botname,
        decorate,
        ecrType,
        exploding,
        hasReactions,
        isPendingPayment,
        reactionsPopupPosition,
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
  return {...d, isEditing}
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
  popupAnchor: React.RefObject<Kb.MeasureRef>
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  setShowingPicker: (s: boolean) => void
  showCoinsIcon: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showSendIndicator: boolean
  showingPicker: boolean
  showingPopup: boolean
  toggleShowingPopup: () => void
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
  const {showingPopup, ecrType, exploding, hasReactions, isPendingPayment, popupAnchor} = p
  const {type, reactionsPopupPosition, setShowingPicker, showCoinsIcon} = p
  const {toggleShowingPopup, showExplodingCountdown, showRevoked, showSendIndicator, showingPicker} = p
  const pressableProps = Kb.Styles.isMobile
    ? {
        onLongPress: decorate ? toggleShowingPopup : undefined,
        style: isHighlighted ? {backgroundColor: Kb.Styles.globalColors.yellowOrYellowAlt} : undefined,
      }
    : {
        className: Kb.Styles.classNames({
          TextAndSiblings: true,
          noOverflow: isPendingPayment,
          systemMessage: type.startsWith('system'),
          // eslint-disable-next-line
          active: showingPopup || showingPicker,
        }),
        onContextMenu: toggleShowingPopup,
        // attach popups to the message itself
        ref: popupAnchor,
      }

  const Background = isPendingPayment ? PendingPaymentBackground : NormalWrapper

  const content = exploding ? (
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
      <Kb.Box2 direction="vertical" style={styles.middle} fullWidth={!Kb.Styles.isMobile}>
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

const useHighlightMode = (ordinal: T.Chat.Ordinal) => {
  const centeredOrdinalType = C.useChatContext(s => {
    const i = s.messageCenterOrdinal
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
  const ordinal = React.useContext(OrdinalContext)
  const {failureDescription, outboxID} = C.useChatContext(
    C.useShallow(s => {
      const m = s.messageMap.get(ordinal)
      const outboxID = m?.outboxID
      const reason = m?.errorReason ?? ''
      const failureDescription = `This messge failed to send${reason ? '. ' : ''}${capitalize(reason)}`
      return {failureDescription, outboxID}
    })
  )
  const messageDelete = C.useChatContext(s => s.dispatch.messageDelete)
  const onCancel = React.useCallback(() => {
    messageDelete(ordinal)
  }, [messageDelete, ordinal])
  const setEditing = C.useChatContext(s => s.dispatch.setEditing)
  const onEdit = React.useCallback(() => {
    setEditing(ordinal)
  }, [setEditing, ordinal])
  const messageRetry = C.useChatContext(s => s.dispatch.messageRetry)
  const onRetry = React.useCallback(() => {
    outboxID && messageRetry(outboxID)
  }, [messageRetry, outboxID])

  const cancel = (
    <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onCancel}>
      Cancel
    </Kb.Text>
  )

  const or =
    ecrType === EditCancelRetryType.EDIT_CANCEL || ecrType === EditCancelRetryType.RETRY_CANCEL ? (
      <Kb.Text type="BodySmall"> or </Kb.Text>
    ) : null

  const action: React.ReactNode =
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
    !C.isMobile && reactionsPopupPosition !== 'none' && !showingPopup ? (
      <EmojiRow
        className={Kb.Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
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
      <Kb.Icon type="iconfont-rip" color={Kb.Styles.globalColors.black_35} />
    </Kb.WithTooltip>
  ) : null

  const coinsIcon = showCoinsIcon ? <Kb.Icon type="icon-stellar-coins-stacked-16" /> : null

  const bot = botname ? (
    <Kb.WithTooltip tooltip={`Encrypted for @${botname}`}>
      <Kb.Icon color={Kb.Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.WithTooltip>
  ) : null

  const hasVisibleItems = !!explodingCountdown || !!revokedIcon || !!coinsIcon || !!bot

  // On mobile there is no ... menu
  // On Desktop we float the menu on top, if there are no items
  // if there are items we show them. We want the ... to take space but not be visible, so we move it to the
  // left, then on hover we invert the list so its on the right. Theres usually only 1 non menu item so this
  // is fine

  const menu = C.isMobile ? null : (
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
        className={Kb.Styles.classNames({
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
  const {ordinal, bottomChildren, children} = p

  // passed in context so stable
  const ordinalRef = React.useRef(ordinal)
  ordinalRef.current = ordinal

  const {showCenteredHighlight, toggleShowingPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)

  const mdata = useRedux(ordinal)

  const {isPendingPayment, decorate, type, hasReactions, isEditing} = mdata
  const {ecrType, showSendIndicator, showRevoked, showExplodingCountdown, exploding} = mdata
  const {reactionsPopupPosition, showCoinsIcon, botname, you, youSent} = mdata

  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight && !isEditing

  const maybeSentChildren = C.isMobile && youSent ? <Sent>{children}</Sent> : children

  const tsprops = {
    botname,
    bottomChildren,
    children: maybeSentChildren,
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
    <OrdinalContext.Provider value={ordinal}>
      <HighlightedContext.Provider value={showCenteredHighlight}>
        <Kb.Styles.CanFixOverdrawContext.Provider value={canFixOverdraw}>
          <TextAndSiblings {...tsprops} />
          {popup}
        </Kb.Styles.CanFixOverdrawContext.Provider>
      </HighlightedContext.Provider>
    </OrdinalContext.Provider>
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
        isElectron: {height: 4, paddingTop: 0},
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
          bottom: -Kb.Styles.globalMargins.medium + 3,
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
