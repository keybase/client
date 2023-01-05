import * as Constants from '../../../../constants/chat2'
import * as Chat2Gen from '../../../../actions/chat2-gen'
import * as ProfileGen from '../../../../actions/profile-gen'
import * as Tracker2Gen from '../../../../actions/tracker2-gen'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as RPCChatTypes from '../../../../constants/types/rpc-chat-gen'
import shallowEqual from 'shallowequal'
import {ConvoIDContext, OrdinalContext} from '../ids-context'
import EmojiRow from '../react-button/emoji-row/container'
import ExplodingHeightRetainer from './exploding-height-retainer/container'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import MessagePopup from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import ReactionsRow from '../reactions-row/container'
import SendIndicator from './send-indicator'
import type * as Types from '../../../../constants/types/chat2'
import type PaymentMessageType from '../account-payment/container'
import type PinType from '../pin'
import type SetChannelnameType from '../set-channelname/container'
import type SetDescriptionType from '../set-description/container'
import type SystemAddedToTeamType from '../system-added-to-team/container'
import type SystemChangeAvatarType from '../system-change-avatar'
import type SystemChangeRetentionType from '../system-change-retention/container'
import type SystemCreateTeamType from '../system-create-team/container'
import type SystemGitPushType from '../system-git-push/container'
import type SystemInviteAcceptedType from '../system-invite-accepted/container'
import type SystemJoinedType from '../system-joined/container'
import type SystemLeftType from '../system-left/container'
import type SystemNewChannelType from '../system-new-channel/container'
import type SystemSBSResolvedType from '../system-sbs-resolve/container'
import type SystemSimpleToComplexType from '../system-simple-to-complex/container'
import type SystemTextType from '../system-text/container'
import type SystemUsersAddedToConvType from '../system-users-added-to-conv/container'
import {formatTimeForChat} from '../../../../util/timestamp'
import capitalize from 'lodash/capitalize'
import type {TeamRoleType} from '../../../../constants/types/teams'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * row, and exploding meta tag.
 */

export type Props = {
  ordinal: Types.Ordinal
  measure?: () => void
  previous?: Types.Ordinal
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

  const type = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal)?.type)
  const shouldShowPopup = Container.useSelector(state =>
    Constants.shouldShowPopup(state, Constants.getMessage(state, conversationIDKey, ordinal) ?? undefined)
  )

  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo =>
    messageShowsPopup(type) && shouldShowPopup && showingPopup ? (
      <MessagePopup
        conversationIDKey={conversationIDKey}
        ordinal={ordinal}
        key="popup"
        attachTo={attachTo}
        onHidden={toggleShowingPopup}
        position="top right"
        style={styles.messagePopupContainer}
        visible={showingPopup}
      />
    ) : null
  )

  return {popup, popupAnchor, showCenteredHighlight, showingPopup, toggleShowingPopup}
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

const useRedux = (
  conversationIDKey: Types.ConversationIDKey,
  ordinal: Types.Ordinal,
  previous?: Types.Ordinal
) => {
  const getBotname = (
    state: Container.TypedState,
    message: Types.Message,
    meta: Types.ConversationMeta,
    authorRoleInTeam?: TeamRoleType
  ) => {
    const keyedBot = message.botUsername
    if (!keyedBot) return ''
    const participantInfoNames = Constants.getParticipantInfo(state, message.conversationIDKey).name
    const authorIsBot = meta.teamname
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : meta.teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfoNames.includes(message.author) // if adhoc, check if author in participants
      : false // if we don't have team information, don't show bot icon
    return !authorIsBot ? keyedBot : ''
  }

  const getUsernameToShow = (message: Types.Message, pMessage: Types.Message | undefined, you: string) => {
    switch (message.type) {
      case 'journeycard':
        return 'placeholder'
      case 'systemAddedToTeam':
        return message.adder
      case 'systemInviteAccepted':
        return message.invitee === you ? '' : message.invitee
      case 'setDescription':
      case 'pin':
      case 'systemUsersAddedToConversation':
        return message.author
      case 'systemJoined': {
        const joinLeaveLength = (message?.joiners?.length ?? 0) + (message?.leavers?.length ?? 0)
        return joinLeaveLength > 1 ? '' : message.author
      }
      case 'systemSBSResolved':
        return message.prover
      case 'setChannelname':
        // suppress this message for the #general channel, it is redundant.
        return message.newChannelname !== 'general' ? message.author : ''
      case 'attachment':
      case 'requestPayment':
      case 'sendPayment':
      case 'text':
        break
      default:
        return message.author
    }

    if (!pMessage) return ''

    if (
      !pMessage.type ||
      pMessage.author !== message.author ||
      pMessage.botUsername !== message.botUsername ||
      !authorIsCollapsible(message.type) ||
      !authorIsCollapsible(pMessage.type) ||
      enoughTimeBetweenMessages(message.timestamp, pMessage.timestamp)
    ) {
      return message.author
    }
    // should be impossible
    return ''
  }

  return Container.useSelector(state => {
    const you = state.config.username
    const m = Constants.getMessage(state, conversationIDKey, ordinal) ?? missingMessage
    const meta = Constants.getMeta(state, conversationIDKey)
    const {exploding, exploded, submitState, author, timestamp, id} = m
    const isPendingPayment = Constants.isPendingPaymentMessage(state, m)
    const decorate = !exploded && !m.errorReason
    const type = m.type
    const showSendIndicator = !submitState && !exploded && you === author && id !== ordinal
    const showRevoked = !!m?.deviceRevokedAt
    const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
    const showCoinsIcon = Constants.hasSuccessfulInlinePayments(state, m)
    const hasReactions = !Container.isMobile && (m.reactions?.size ?? 0) > 0
    const authorRoleInTeam = state.teams.teamIDToMembers.get(meta.teamID ?? '')?.get(author)?.type
    const botAlias = meta.botAliases[author] ?? ''
    const orangeLineAbove = state.chat2.orangeLineMap.get(conversationIDKey) === ordinal
    const botname = getBotname(state, m, meta, authorRoleInTeam)
    const pmessage = (previous && Constants.getMessage(state, conversationIDKey, previous)) || undefined
    const showUsername = getUsernameToShow(m, pmessage, you)

    return {
      author,
      authorRoleInTeam,
      botAlias,
      botname,
      decorate,
      exploding,
      hasReactions,
      isPendingPayment,
      orangeLineAbove,
      showCoinsIcon,
      showExplodingCountdown,
      showRevoked,
      showSendIndicator,
      showUsername,
      timestamp,
      type,
    }
  }, shallowEqual)
}

export const WrapperMessage = React.memo(function WrapperMessage(p: WMProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {measure, ordinal, previous, bottomChildren, children} = p
  const {showCenteredHighlight, toggleShowingPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)

  const mdata = useRedux(conversationIDKey, ordinal, previous)

  const {isPendingPayment, decorate, type, author, timestamp, hasReactions} = mdata
  const {showSendIndicator, showRevoked, showExplodingCountdown, exploding, showUsername} = mdata
  const {showCoinsIcon, authorRoleInTeam, botAlias, orangeLineAbove, botname} = mdata

  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight
  const canFixOverdrawValue = React.useMemo(() => ({canFixOverdraw}), [canFixOverdraw])

  // TODO better way to measure
  // const prevMessage = Container.usePrevious2(message)
  // if (measure && message !== prevMessage) {
  //   measure()
  // }

  const content = exploding ? (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <ExplodingHeightRetainer conversationIDKey={conversationIDKey} ordinal={ordinal} measure={measure}>
        {children}
      </ExplodingHeightRetainer>
    </Kb.Box2>
  ) : (
    children
  )

  const paymentBackground = isPendingPayment ? <PendingPaymentBackground /> : null

  const you = Container.useSelector(state => state.config.username)
  const authorIsBot = Container.useSelector(state => {
    const participantInfoNames = Constants.getParticipantInfo(state, conversationIDKey).name
    const meta = Constants.getMeta(state, conversationIDKey)
    const {teamname, teamType} = meta
    return teamname
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfoNames.includes(author) // if adhoc, check if author in participants
      : false // if we don't have team information, don't show bot icon
  })

  const reactionsPopupPosition = Container.useSelector(state => {
    if (Container.isMobile) return 'none'
    if (hasReactions) {
      return 'none'
    }
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    const validMessage = message && Constants.isMessageWithReactions(message)
    if (!validMessage) return 'none'

    const ordinals = Constants.getMessageOrdinals(state, conversationIDKey)
    return ordinals[ordinals.length - 1] === ordinal ? 'last' : 'middle'
  })

  const ecrType = Container.useSelector(state => {
    const message = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)
    if (!message || !state.config.username) {
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
  })

  const presschildren = (
    <>
      {paymentBackground}
      <LeftSide username={showUsername} />
      <RightSide
        botname={botname}
        showSendIndicator={showSendIndicator}
        showExplodingCountdown={showExplodingCountdown}
        showRevoked={showRevoked}
        showCoinsIcon={showCoinsIcon}
        showCenteredHighlight={showCenteredHighlight}
        toggleShowingPopup={toggleShowingPopup}
      />
      <Kb.Box2 direction="vertical" style={styles.middleSide} fullWidth={true}>
        {showUsername ? (
          <TopSide
            author={author}
            botAlias={botAlias}
            showUsername={showUsername}
            showCenteredHighlight={showCenteredHighlight}
            you={you}
            timestamp={timestamp}
            authorRoleInTeam={authorRoleInTeam}
            authorIsBot={authorIsBot}
          />
        ) : null}
        {content}
        <BottomSide
          ecrType={ecrType}
          reactionsPopupPosition={reactionsPopupPosition}
          hasReactions={hasReactions}
          orangeLineAbove={orangeLineAbove}
          bottomChildren={bottomChildren}
          measure={measure}
          showCenteredHighlight={showCenteredHighlight}
          toggleShowingPopup={toggleShowingPopup}
          setShowingPicker={setShowingPicker}
          showingPopup={showingPopup}
        />
      </Kb.Box2>
    </>
  )

  const dispatch = Container.useDispatch()
  const onReply = React.useCallback(() => {
    conversationIDKey &&
      ordinal &&
      dispatch(Chat2Gen.createToggleReplyToMessage({conversationIDKey, ordinal}))
  }, [dispatch, conversationIDKey, ordinal])

  const longPressable = Styles.isMobile ? (
    <LongPressable
      onLongPress={decorate ? toggleShowingPopup : undefined}
      onSwipeLeft={onReply}
      style={showCenteredHighlight ? styles.longPressableHighlight : styles.longPressable}
    >
      {presschildren}
    </LongPressable>
  ) : (
    <LongPressable
      className={Styles.classNames(
        {
          'WrapperMessage-author': showUsername,
          'WrapperMessage-centered': showCenteredHighlight,
          'WrapperMessage-decorated': decorate,
          'WrapperMessage-hoverColor': !isPendingPayment,
          'WrapperMessage-noOverflow': isPendingPayment,
          'WrapperMessage-systemMessage': type?.startsWith('system'),
          active: showingPopup || showingPicker,
          'hover-container': true,
        },
        'WrapperMessage-hoverBox'
      )}
      onContextMenu={toggleShowingPopup}
      // attach popups to the message itself
      ref={popupAnchor as any}
    >
      {presschildren}
    </LongPressable>
  )

  return (
    <OrdinalContext.Provider value={ordinal}>
      <Styles.StyleContext.Provider value={canFixOverdrawValue}>
        {longPressable}
        {popup}
      </Styles.StyleContext.Provider>
    </OrdinalContext.Provider>
  )
})

const useHighlightMode = (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) => {
  const centeredOrdinalInfo = Container.useSelector(state =>
    state.chat2.messageCenterOrdinals.get(conversationIDKey)
  )
  const centeredOrdinalType =
    centeredOrdinalInfo?.ordinal === ordinal ? centeredOrdinalInfo?.highlightMode : undefined
  const [disableCenteredHighlight, setDisableCenteredHighlight] = React.useState(false)
  const timeoutIDRef = React.useRef<any>(null)
  const updateHighlightMode = React.useCallback(() => {
    if (disableCenteredHighlight) {
      return
    }
    switch (centeredOrdinalType) {
      case 'flash':
        setDisableCenteredHighlight(false)
        clearTimeout(timeoutIDRef.current)
        timeoutIDRef.current = setTimeout(() => {
          setDisableCenteredHighlight(true)
          timeoutIDRef.current = 0
        }, 2000)
        break
      case 'always':
        setDisableCenteredHighlight(false)
        break
    }
  }, [disableCenteredHighlight, setDisableCenteredHighlight, centeredOrdinalType])

  React.useEffect(() => {
    return () => {
      clearTimeout(timeoutIDRef.current)
    }
  })

  React.useEffect(() => {
    updateHighlightMode()
    // once on mount only
    // eslint-disable-next-line
  }, [])

  const prevCenteredOrdinalTypeRef = React.useRef(centeredOrdinalType)
  if (centeredOrdinalType && prevCenteredOrdinalTypeRef.current !== centeredOrdinalType) {
    prevCenteredOrdinalTypeRef.current = centeredOrdinalType
    updateHighlightMode()
  }

  return !disableCenteredHighlight && centeredOrdinalType !== undefined
}

const enoughTimeBetweenMessages = (mtimestamp?: number, ptimestamp?: number): boolean =>
  !!ptimestamp && !!mtimestamp && mtimestamp - ptimestamp > 1000 * 60 * 15

// Used to decide whether to show the author for sequential messages
const authorIsCollapsible = (type?: Types.MessageType) =>
  type === 'text' || type === 'deleted' || type === 'attachment'

type TProps = {
  showCenteredHighlight: boolean
  showUsername: string
  authorRoleInTeam?: string
  authorIsBot: boolean
  author: string
  botAlias: string
  you: string
  timestamp: number
}
// Author
const TopSide = React.memo(function TopSide(p: TProps) {
  const {you, author, botAlias, showUsername, authorIsBot, authorRoleInTeam, showCenteredHighlight} = p
  const {timestamp} = p
  const youAreAuthor = you === author

  const dispatch = Container.useDispatch()
  const onAuthorClick = React.useCallback(() => {
    if (Container.isMobile) {
      showUsername && dispatch(ProfileGen.createShowUserProfile({username: showUsername}))
    } else {
      showUsername && dispatch(Tracker2Gen.createShowUser({asTracker: true, username: showUsername}))
    }
  }, [dispatch, showUsername])

  const authorIsOwner = authorRoleInTeam === 'owner'
  const authorIsAdmin = authorRoleInTeam === 'admin'

  const usernameNode = (
    <Kb.ConnectedUsernames
      colorBroken={true}
      colorFollowing={true}
      colorYou={true}
      onUsernameClicked={onAuthorClick}
      fixOverdraw="auto"
      style={showCenteredHighlight && youAreAuthor ? styles.usernameHighlighted : undefined}
      type="BodySmallBold"
      usernames={showUsername}
      virtualText={true}
    />
  )

  const ownerAdminTooltipIcon =
    authorIsOwner || authorIsAdmin ? (
      <Kb.WithTooltip tooltip={authorIsOwner ? 'Owner' : 'Admin'}>
        <Kb.Icon
          color={authorIsOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35}
          fontSize={10}
          type="iconfont-crown-owner"
        />
      </Kb.WithTooltip>
    ) : null

  const botIcon = authorIsBot ? (
    <Kb.WithTooltip tooltip="Bot">
      <Kb.Icon fontSize={13} color={Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.WithTooltip>
  ) : null

  const botAliasOrUsername = botAlias ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1}>
        {botAlias}
      </Kb.Text>
      <Kb.Text type="BodySmallBold" style={{color: Styles.globalColors.black}}>
        &nbsp;[
      </Kb.Text>
      {showUsername}
      <Kb.Text type="BodySmallBold" style={{color: Styles.globalColors.black}}>
        ]
      </Kb.Text>
    </Kb.Box2>
  ) : (
    usernameNode
  )

  const timestampNode = (
    <Kb.Text
      type="BodyTiny"
      fixOverdraw={false}
      virtualText={true}
      style={Styles.collapseStyles([showCenteredHighlight && styles.timestampHighlighted])}
    >
      {formatTimeForChat(timestamp)}
    </Kb.Text>
  )

  return (
    <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
      <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.usernameCrown}>
        {botAliasOrUsername}
        {ownerAdminTooltipIcon}
        {botIcon}
        {timestampNode}
      </Kb.Box2>
    </Kb.Box2>
  )
})

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
  const outboxID = Container.useSelector(
    state => state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)?.outboxID
  )
  const failureDescription = Container.useSelector(state => {
    const reason = state.chat2.messageMap.get(conversationIDKey)?.get(ordinal)?.errorReason ?? ''
    return `This messge failed to send${reason ? '. ' : ''}${capitalize(reason)}`
  })
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
  showCenteredHighlight: boolean
  toggleShowingPopup: () => void
  measure?: () => void
  showingPopup: boolean
  setShowingPicker: (s: boolean) => void
  bottomChildren?: React.ReactNode
  hasReactions: boolean
  orangeLineAbove: boolean
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  ecrType: EditCancelRetryType
}
// Edited, reactions, orangeLine (top side but needs to render on top so here)
const BottomSide = React.memo(function BottomSide(p: BProps) {
  const {showingPopup, setShowingPicker, bottomChildren, ecrType} = p
  const {orangeLineAbove, hasReactions, reactionsPopupPosition} = p

  const orangeLine = orangeLineAbove ? (
    <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine} />
  ) : null

  const reactionsRow =
    !Container.isMobile && hasReactions ? (
      <ReactionsRow
        btnClassName="WrapperMessage-emojiButton"
        newBtnClassName="WrapperMessage-newEmojiButton"
      />
    ) : null

  const reactionsPopup =
    !Container.isMobile && reactionsPopupPosition !== 'none' && !showingPopup ? (
      <EmojiRow
        className={Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
        onShowingEmojiPicker={setShowingPicker}
        tooltipPosition={reactionsPopupPosition === 'middle' ? 'top center' : 'bottom center'}
        style={reactionsPopupPosition === 'last' ? styles.emojiRowLast : styles.emojiRow}
      />
    ) : null

  return (
    <>
      {orangeLine}
      {bottomChildren ?? null}
      {ecrType !== EditCancelRetryType.NONE ? <EditCancelRetry ecrType={ecrType} /> : null}
      {reactionsRow}
      {reactionsPopup}
    </>
  )
})

// Author Avatar
type LProps = {
  username?: string
}
const LeftSide = React.memo(function LeftSide(p: LProps) {
  const {username} = p
  const dispatch = Container.useDispatch()
  const onAuthorClick = React.useCallback(() => {
    if (!username) return
    if (Container.isMobile) {
      dispatch(ProfileGen.createShowUserProfile({username}))
    } else {
      dispatch(Tracker2Gen.createShowUser({asTracker: true, username}))
    }
  }, [dispatch, username])

  return username ? (
    <Kb.Avatar
      size={32}
      username={username}
      skipBackground={true}
      onClick={onAuthorClick}
      style={styles.avatar}
    />
  ) : null
})

// Exploding, ... , sending, tombstone
type RProps = {
  showCenteredHighlight: boolean
  toggleShowingPopup: () => void
  showSendIndicator: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showCoinsIcon: boolean
  botname?: string
}
const RightSide = React.memo(function RightSide(p: RProps) {
  const {showCenteredHighlight, toggleShowingPopup, showSendIndicator, showCoinsIcon} = p
  const {showExplodingCountdown, showRevoked, botname} = p
  const sendIndicator = showSendIndicator ? <SendIndicator /> : null

  const explodingCountdown = showExplodingCountdown ? (
    <ExplodingMeta isParentHighlighted={showCenteredHighlight} onClick={toggleShowingPopup} />
  ) : null

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

  const menu = Container.isMobile ? null : (
    <Kb.WithTooltip tooltip="More actions..." toastStyle={styles.moreActionsTooltip}>
      <Kb.Box style={styles.ellipsis} className="hover-visible">
        <Kb.Icon type="iconfont-ellipsis" onClick={toggleShowingPopup} />
      </Kb.Box>
    </Kb.WithTooltip>
  )

  const any = sendIndicator || explodingCountdown || revokedIcon || coinsIcon || bot || menu

  return any ? (
    <Kb.Box2 direction="horizontal" style={styles.rightSide} gap="tiny">
      {sendIndicator}
      {explodingCountdown}
      {revokedIcon}
      {coinsIcon}
      {bot}
      {menu}
    </Kb.Box2>
  ) : null
})

const useMessageNode = (ordinal: Types.Ordinal) => {
  const conversationIDKey = React.useContext(ConvoIDContext)

  const message = Container.useSelector(state => Constants.getMessage(state, conversationIDKey, ordinal))
  const youAreAuthor = Container.useSelector(
    state => Constants.getMessage(state, conversationIDKey, ordinal)?.author === state.config.username
  )

  if (!message) return null

  switch (message.type) {
    case 'requestPayment': {
      const PaymentMessage = require('../account-payment/container').default as typeof PaymentMessageType
      return <PaymentMessage key="requestPayment" message={message} />
    }
    case 'sendPayment': {
      const PaymentMessage = require('../account-payment/container').default as typeof PaymentMessageType
      return <PaymentMessage key="sendPayment" message={message} />
    }
    case 'systemInviteAccepted': {
      const SystemInviteAccepted = require('../system-invite-accepted/container')
        .default as typeof SystemInviteAcceptedType
      return <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    }
    case 'systemSBSResolved':
      if (youAreAuthor) {
        const SystemSBSResolved = require('../system-sbs-resolve/container')
          .default as typeof SystemSBSResolvedType
        return <SystemSBSResolved key="systemSbsResolved" message={message} />
      } else {
        const SystemJoined = require('../system-joined/container').default as typeof SystemJoinedType
        return (
          <SystemJoined
            key="systemJoined"
            message={{...message, joiners: [message.prover], leavers: [], type: 'systemJoined'}}
          />
        )
      }
    case 'systemSimpleToComplex': {
      const SystemSimpleToComplex = require('../system-simple-to-complex/container')
        .default as typeof SystemSimpleToComplexType
      return <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
    }
    case 'systemGitPush': {
      const SystemGitPush = require('../system-git-push/container').default as typeof SystemGitPushType
      return <SystemGitPush key="systemGitPush" message={message} />
    }
    case 'systemCreateTeam': {
      const SystemCreateTeam = require('../system-create-team/container')
        .default as typeof SystemCreateTeamType
      return <SystemCreateTeam key="systemCreateTeam" message={message} />
    }
    case 'systemAddedToTeam': {
      const SystemAddedToTeam = require('../system-added-to-team/container')
        .default as typeof SystemAddedToTeamType
      return <SystemAddedToTeam key="systemAddedToTeam" message={message} />
    }
    case 'systemChangeRetention': {
      const SystemChangeRetention = require('../system-change-retention/container')
        .default as typeof SystemChangeRetentionType
      return <SystemChangeRetention key="systemChangeRetention" message={message} />
    }
    case 'systemUsersAddedToConversation': {
      const SystemUsersAddedToConv = require('../system-users-added-to-conv/container')
        .default as typeof SystemUsersAddedToConvType
      return <SystemUsersAddedToConv key="systemUsersAddedToConv" message={message} />
    }
    case 'systemJoined': {
      const SystemJoined = require('../system-joined/container').default as typeof SystemJoinedType
      return <SystemJoined key="systemJoined" message={message} />
    }
    case 'systemText': {
      const SystemText = require('../system-text/container').default as typeof SystemTextType
      return <SystemText key="systemText" message={message} />
    }
    case 'systemLeft': {
      const SystemLeft = require('../system-left/container').default as typeof SystemLeftType
      return <SystemLeft key="systemLeft" message={message} />
    }
    case 'systemChangeAvatar': {
      const SystemChangeAvatar = require('../system-change-avatar').default as typeof SystemChangeAvatarType
      return <SystemChangeAvatar key="systemChangeAvatar" message={message} />
    }
    case 'systemNewChannel': {
      const SystemNewChannel = require('../system-new-channel/container')
        .default as typeof SystemNewChannelType
      return <SystemNewChannel key="systemNewChannel" message={message} />
    }
    case 'setDescription': {
      const SetDescription = require('../set-description/container').default as typeof SetDescriptionType
      return <SetDescription key="setDescription" message={message} />
    }
    case 'pin': {
      const Pin = require('../pin').default as typeof PinType
      return (
        <Pin key="pin" conversationIDKey={message.conversationIDKey} messageID={message.pinnedMessageID} />
      )
    }
    case 'setChannelname': {
      // suppress this message for the #general channel, it is redundant.
      const SetChannelname = require('../set-channelname/container').default as typeof SetChannelnameType
      return message.newChannelname === 'general' ? null : (
        <SetChannelname key="setChannelname" message={message} />
      )
    }
    default:
      console.log('WrapperGeneric missing type???', message.type)
      return null
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        common: {position: 'absolute', top: 8},
        isElectron: {left: Styles.globalMargins.small},
        isMobile: {left: Styles.globalMargins.tiny},
      }),
      botAlias: Styles.platformStyles({
        common: {color: Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
      contentUnderAuthorContainer: Styles.platformStyles({
        isElectron: {
          // marginTop: -16,
          // paddingLeft:
          //   // Space for below the avatar
          //   Styles.globalMargins.tiny + // right margin
          //   Styles.globalMargins.small + // left margin
          //   Styles.globalMargins.mediumLarge, // avatar
        },
        isMobile: {
          // marginTop: -12,
          // paddingBottom: 3,
          // paddingLeft:
          //   // Space for below the avatar
          //   Styles.globalMargins.tiny + // right margin
          //   Styles.globalMargins.tiny + // left margin
          //   Styles.globalMargins.mediumLarge, // avatar
          // paddingRight: Styles.globalMargins.tiny,
        },
      }),
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
      ellipsis: {
        // marginLeft: Styles.globalMargins.tiny,
        paddingTop: 3,
      },
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
      longPressable: {
        overflow: 'hidden',
        paddingBottom: 3,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: 3,
      },
      longPressableHighlight: {
        backgroundColor: Styles.globalColors.yellowOrYellowAlt,
        overflow: 'hidden',
        paddingBottom: 3,
        paddingRight: Styles.globalMargins.tiny,
        paddingTop: 3,
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
      // menuButtonsWithAuthor: {marginTop: -16},
      messagePopupContainer: {marginRight: Styles.globalMargins.small},
      middleSide: {
        alignItems: 'stretch',
        paddingLeft: 56,
        paddingRight: 4,
      },
      moreActionsTooltip: {marginRight: -Styles.globalMargins.xxtiny},
      orangeLine: {
        // don't push down content due to orange line
        backgroundColor: Styles.globalColors.orange,
        flexShrink: 0,
        height: 1,
        left: 0,
        position: 'absolute',
        right: 0,
        top: 0,
      },
      orangeLineCompensationLeft: Styles.platformStyles({
        // compensate for containerNoUsername's padding
        isMobile: {left: -Styles.globalMargins.mediumLarge},
      }),
      paddingLeftTiny: {paddingLeft: Styles.globalMargins.tiny},
      rightSide: {
        backgroundColor: Styles.globalColors.white_90,
        borderRadius: Styles.borderRadius,
        minHeight: 20,
        paddingLeft: Styles.globalMargins.tiny,
        paddingRight: Styles.globalMargins.tiny,
        position: 'absolute',
        right: 21,
        top: 1,
      },
      timestamp: Styles.platformStyles({
        isElectron: {
          flexShrink: 0,
          lineHeight: 19,
        },
      }),
      timestampHighlighted: {color: Styles.globalColors.black_50OrBlack_40},
      usernameCrown: Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
          marginRight: 48,
          position: 'relative',
          top: -2,
        },
        isMobile: {alignItems: 'center'},
      }),
      usernameHighlighted: {color: Styles.globalColors.blackOrBlack},
    } as const)
)

export const WrapperGeneric = React.memo(function WrapperText(p: Props) {
  const {ordinal} = p
  const common = useCommon(ordinal)
  const messageNode = useMessageNode(ordinal)

  return (
    <WrapperMessage {...p} {...common}>
      {messageNode}
    </WrapperMessage>
  )
})
