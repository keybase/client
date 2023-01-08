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
import {ConvoIDContext, OrdinalContext, GetIdsContext} from '../ids-context'
import EmojiRow from '../react-button/emoji-row/container'
import ExplodingHeightRetainer from './exploding-height-retainer/container'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import MessagePopup from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import ReactionsRow from '../reactions-row/container'
import SendIndicator from './send-indicator'
import type * as Types from '../../../../constants/types/chat2'
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

  const {type, shouldShowPopup} = Container.useSelector(state => {
    const m = Constants.getMessage(state, conversationIDKey, ordinal)
    const type = m?.type
    const shouldShowPopup = Constants.shouldShowPopup(state, m ?? undefined)
    return {shouldShowPopup, type}
  }, shallowEqual)

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
    const {exploded, submitState, author, timestamp, id} = m
    const exploding = !!m.exploding
    const meta = Constants.getMeta(state, conversationIDKey)
    const {teamname, teamType, teamID} = meta
    const isPendingPayment = Constants.isPendingPaymentMessage(state, m)
    const decorate = !exploded && !m.errorReason
    const type = m.type
    const showSendIndicator = !submitState && !exploded && you === author && id !== ordinal
    const showRevoked = !!m?.deviceRevokedAt
    const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
    const showCoinsIcon = Constants.hasSuccessfulInlinePayments(state, m)
    const hasReactions = !Container.isMobile && (m.reactions?.size ?? 0) > 0
    const authorRoleInTeam = state.teams.teamIDToMembers.get(teamID ?? '')?.get(author)?.type
    const botAlias = meta.botAliases[author] ?? ''
    const orangeLineAbove = state.chat2.orangeLineMap.get(conversationIDKey) === ordinal
    const botname = getBotname(state, m, meta, authorRoleInTeam)
    const pmessage = (previous && Constants.getMessage(state, conversationIDKey, previous)) || undefined
    const showUsername = getUsernameToShow(m, pmessage, you)
    const participantInfoNames = Constants.getParticipantInfo(state, conversationIDKey).name
    const authorIsBot = teamname
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfoNames.includes(author) // if adhoc, check if author in participants
      : false // if we don't have team information, don't show bot icon
    const reactionsPopupPosition = getReactionsPopupPosition(hasReactions, m, state)
    const ecrType = getEcrType(m, you)
    return {
      author,
      authorIsBot,
      authorRoleInTeam,
      botAlias,
      botname,
      decorate,
      ecrType,
      exploding,
      hasReactions,
      isPendingPayment,
      orangeLineAbove,
      reactionsPopupPosition,
      showCoinsIcon,
      showExplodingCountdown,
      showRevoked,
      showSendIndicator,
      showUsername,
      timestamp,
      type,
      you,
    }
  }, shallowEqual)
}

type TSProps = {
  author: string
  authorIsBot: boolean
  authorRoleInTeam?: string
  botAlias: string
  botname: string
  bottomChildren: React.ReactNode
  children: React.ReactNode
  decorate: boolean
  ecrType: EditCancelRetryType
  exploding: boolean
  hasReactions: boolean
  isPendingPayment: boolean
  measure?: () => void
  orangeLineAbove: boolean
  popupAnchor: React.MutableRefObject<React.Component | null>
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  setShowingPicker: (s: boolean) => void
  showCenteredHighlight: boolean
  showCoinsIcon: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showSendIndicator: boolean
  showUsername: string
  showingPicker: boolean
  showingPopup: boolean
  timestamp: number
  toggleShowingPopup: () => void
  type: Types.MessageType
  you: string
}

const TextAndSiblings = React.memo(function TextAndSiblings(p: TSProps) {
  const {author, authorIsBot, authorRoleInTeam, botAlias, botname, bottomChildren, children, decorate} = p
  const {ecrType, exploding, hasReactions, isPendingPayment, measure, orangeLineAbove, popupAnchor} = p
  const {reactionsPopupPosition, setShowingPicker, showCenteredHighlight, showCoinsIcon} = p
  const {showExplodingCountdown, showRevoked, showSendIndicator, showUsername, showingPicker} = p
  const {showingPopup, timestamp, toggleShowingPopup, type, you} = p
  const pressableProps = Styles.isMobile
    ? {
        onLongPress: decorate ? toggleShowingPopup : undefined,
        style: showCenteredHighlight ? styles.longPressableHighlight : styles.longPressable,
      }
    : {
        className: Styles.classNames(
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
        ),
        onContextMenu: toggleShowingPopup,
        // attach popups to the message itself
        ref: popupAnchor as any,
      }

  // TODO could move to sentPayment
  const paymentBackground = isPendingPayment ? <PendingPaymentBackground /> : null

  const content = exploding ? (
    <Kb.Box2 direction="horizontal" fullWidth={true}>
      <ExplodingHeightRetainer measure={measure}>{children}</ExplodingHeightRetainer>
    </Kb.Box2>
  ) : (
    children
  )

  return (
    <LongPressable {...pressableProps}>
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
            showUsername={showUsername}
            showCenteredHighlight={showCenteredHighlight}
            botAlias={botAlias}
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
    </LongPressable>
  )
})

export const WrapperMessage = React.memo(function WrapperMessage(p: WMProps) {
  const conversationIDKey = React.useContext(ConvoIDContext)
  const {measure, ordinal, previous, bottomChildren, children} = p

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

  const mdata = useRedux(conversationIDKey, ordinal, previous)

  const {isPendingPayment, decorate, type, author, timestamp, hasReactions, authorIsBot} = mdata
  const {showSendIndicator, showRevoked, showExplodingCountdown, exploding, showUsername} = mdata
  const {showCoinsIcon, authorRoleInTeam, botAlias, orangeLineAbove, botname, you} = mdata
  const {reactionsPopupPosition, ecrType} = mdata

  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight

  const tsprops = {
    author,
    authorIsBot,
    authorRoleInTeam,
    botAlias,
    botname,
    bottomChildren,
    children,
    decorate,
    ecrType,
    exploding,
    hasReactions,
    isPendingPayment,
    measure,
    orangeLineAbove,
    popupAnchor,
    reactionsPopupPosition,
    setShowingPicker,
    showCenteredHighlight,
    showCoinsIcon,
    showExplodingCountdown,
    showRevoked,
    showSendIndicator,
    showUsername,
    showingPicker,
    showingPopup,
    // hurts recycling and not needed
    timestamp: showUsername ? timestamp : 0,
    toggleShowingPopup,
    type,
    you,
  }

  return (
    <GetIdsContext.Provider value={getIds}>
      <OrdinalContext.Provider value={ordinal}>
        <Styles.CanFixOverdrawContext.Provider value={canFixOverdraw}>
          <TextAndSiblings {...tsprops} />
          {popup}
        </Styles.CanFixOverdrawContext.Provider>
      </OrdinalContext.Provider>
    </GetIdsContext.Provider>
  )
})

const useHighlightMode = (conversationIDKey: Types.ConversationIDKey, ordinal: Types.Ordinal) => {
  const centeredOrdinalType = Container.useSelector(state => {
    const i = state.chat2.messageCenterOrdinals.get(conversationIDKey)
    return i?.ordinal === ordinal ? i.highlightMode : undefined
  })

  return centeredOrdinalType !== undefined
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

  const canFixOverdraw = React.useContext(Styles.CanFixOverdrawContext)
  const timestampNode = (
    <Kb.Text
      type="BodyTiny"
      fixOverdraw={canFixOverdraw}
      virtualText={true}
      style={showCenteredHighlight ? styles.timestampHighlighted : undefined}
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
