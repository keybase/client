import * as C from '@/constants'
import * as Chat from '@/stores/chat'
import * as Kb from '@/common-adapters'
import * as React from 'react'
import {MessageContext, useOrdinal} from '../ids-context'
import EmojiRow from '../emoji-row'
import ExplodingHeightRetainer from './exploding-height-retainer'
import ExplodingMeta from './exploding-meta'
import LongPressable from './long-pressable'
import {useMessagePopup} from '../message-popup'
import ReactionsRow from '../reactions-rows'
import SendIndicator from './send-indicator'
import * as T from '@/constants/types'
import capitalize from 'lodash/capitalize'
import {useEdited} from './edited'
import {useCurrentUserState} from '@/stores/current-user'
import {useTeamsState} from '@/stores/teams'
import {useTrackerState} from '@/stores/tracker'
import {navToProfile} from '@/constants/router'
import {formatTimeForChat} from '@/util/timestamp'
import type {ConvoState} from '@/stores/convostate'

export type Props = {
  isCenteredHighlight?: boolean
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

type AuthorProps = {
  author: string
  botAlias: string
  isAdhocBot: boolean
  teamID: T.Teams.TeamID
  teamType: T.Chat.TeamType
  teamname: string
  timestamp: number
  showUsername: string
}

function AuthorSection(p: AuthorProps) {
  const {author, botAlias, isAdhocBot, teamID, teamType, teamname, timestamp, showUsername} = p

  const authorRoleInTeam = useTeamsState(s => s.teamIDToMembers.get(teamID)?.get(author)?.type)
  const showUser = useTrackerState(s => s.dispatch.showUser)

  const onAuthorClick = () => {
    if (C.isMobile) {
      navToProfile(showUsername)
    } else {
      showUser(showUsername, true)
    }
  }

  const authorIsOwner = authorRoleInTeam === 'owner'
  const authorIsAdmin = authorRoleInTeam === 'admin'
  const authorIsBot = teamname
    ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
    : isAdhocBot
  const allowCrown = teamType !== 'adhoc' && (authorIsOwner || authorIsAdmin)

  const usernameNode = (
    <Kb.ConnectedUsernames
      colorBroken={true}
      colorFollowing={true}
      colorYou={true}
      onUsernameClicked={onAuthorClick}
      type="BodySmallBold"
      usernames={showUsername}
      virtualText={true}
      className="separator-text"
    />
  )

  const ownerAdminTooltipIcon = allowCrown ? (
    <Kb.Box2 direction="vertical" tooltip={authorIsOwner ? 'Owner' : 'Admin'}>
      <Kb.Icon
        color={authorIsOwner ? Kb.Styles.globalColors.yellowDark : Kb.Styles.globalColors.black_35}
        fontSize={10}
        type="iconfont-crown-owner"
      />
    </Kb.Box2>
  ) : null

  const botIcon = authorIsBot ? (
    <Kb.Box2 direction="vertical" tooltip="Bot">
      <Kb.Icon fontSize={13} color={Kb.Styles.globalColors.black_35} type="iconfont-bot" />
    </Kb.Box2>
  ) : null

  const botAliasOrUsername = botAlias ? (
    <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1} className="separator-text">
      {botAlias} {' [' + showUsername + ']'}
    </Kb.Text>
  ) : (
    usernameNode
  )

  return (
    <>
      <Kb.Avatar size={32} username={showUsername} onClick={onAuthorClick} style={styles.avatar} />
      <Kb.Box2
        pointerEvents="box-none"
        key="author"
        direction="horizontal"
        style={styles.authorContainer}
        gap="tiny"
      >
        <Kb.Box2
          pointerEvents="box-none"
          direction="horizontal"
          gap="xtiny"
          fullWidth={true}
          style={styles.usernameCrown}
        >
          {botAliasOrUsername}
          {ownerAdminTooltipIcon}
          {botIcon}
          <Kb.Text type="BodyTiny" virtualText={true} className="separator-text">
            {formatTimeForChat(timestamp)}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
    </>
  )
}

const useAuthorData = (ordinal: T.Chat.Ordinal) =>
  Chat.useChatContext(
    C.useShallow(s => {
      const showUsername = s.showUsernameMap.get(ordinal) ?? ''
      if (!showUsername) {
        return {
          author: '',
          botAlias: '',
          isAdhocBot: false,
          showUsername,
          teamID: '' as T.Teams.TeamID,
          teamType: 'adhoc' as T.Chat.TeamType,
          teamname: '',
          timestamp: 0,
        }
      }
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const {author, timestamp} = m
      const {teamID, botAliases, teamType, teamname} = s.meta
      const participantInfoNames = s.participants.name
      const isAdhocBot =
        teamType === 'adhoc' && participantInfoNames.length > 0
          ? !participantInfoNames.includes(author)
          : false
      return {author, botAlias: botAliases[author] ?? '', isAdhocBot, showUsername, teamID, teamType, teamname, timestamp}
    })
  )

function AuthorHeader({ordinal}: {ordinal: T.Chat.Ordinal}) {
  const data = useAuthorData(ordinal)
  if (!data.showUsername) return null
  return <AuthorSection {...data} />
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

const getCommonMessageData = ({
  accountsInfoMap,
  editing,
  isCenteredHighlight,
  message,
  messageCenterOrdinal,
  ordinal,
  paymentStatusMap,
  reactionOrderMap,
  unfurlPrompt,
  you,
}: {
  accountsInfoMap: ConvoState['accountsInfoMap']
  editing: ConvoState['editing']
  isCenteredHighlight?: boolean
  message: T.Chat.Message
  messageCenterOrdinal: ConvoState['messageCenterOrdinal']
  ordinal: T.Chat.Ordinal
  paymentStatusMap: ReturnType<typeof Chat.useChatState.getState>['paymentStatusMap']
  reactionOrderMap: ConvoState['reactionOrderMap']
  unfurlPrompt: ConvoState['unfurlPrompt']
  you: string
}) => {
  const {submitState, author, id, botUsername} = message
  const type = message.type
  const exploded = !!message.exploded
  const idMatchesOrdinal = T.Chat.ordinalToNumber(message.ordinal) === T.Chat.messageIDToNumber(id)
  const exploding = !!message.exploding
  const decorate = !exploded && !message.errorReason
  const isShowingUploadProgressBar =
    you === author && message.type === 'attachment' && message.inlineVideoPlayable
  const showSendIndicator =
    !!submitState && !exploded && you === author && !idMatchesOrdinal && !isShowingUploadProgressBar
  const showRevoked = !!message.deviceRevokedAt
  const showExplodingCountdown = !!exploding && !exploded && submitState !== 'failed'
  const showCoinsIcon = hasSuccessfulInlinePayments(paymentStatusMap, message)
  const hasReactions = (message.reactions?.size ?? 0) > 0
  const botname = botUsername === author ? '' : (botUsername ?? '')
  const canShowReactionsPopup = Chat.isMessageWithReactions(message)
  const ecrType = getEcrType(message, you)
  const shouldShowPopup = Chat.shouldShowPopup(accountsInfoMap, message)
  const hasBeenEdited = message.hasBeenEdited ?? false
  const hasCoinFlip = message.type === 'text' && !!message.flipGameID
  const hasUnfurlList = (message.unfurls?.size ?? 0) > 0
  const hasUnfurlPrompts = !!id && !!unfurlPrompt.get(id)?.size
  const textType: 'error' | 'sent' | 'pending' = message.errorReason ? 'error' : !submitState ? 'sent' : 'pending'
  const replyTo = message.type === 'text' ? message.replyTo : undefined
  const reactions = message.reactions
  const reactionOrder = reactionOrderMap.get(ordinal)
  const isExplodingMessage = message.type === 'text' || message.type === 'attachment'
  const showReplyTo = !!replyTo
  const text =
    message.type === 'text' ? (message.decoratedText?.stringValue() ?? message.text.stringValue()) : ''
  const showCenteredHighlight =
    isCenteredHighlight ??
    !!(
      messageCenterOrdinal &&
      messageCenterOrdinal.highlightMode !== 'none' &&
      messageCenterOrdinal.ordinal === ordinal
    )

  return {
    botname,
    canShowReactionsPopup,
    decorate,
    ecrType,
    exploded,
    exploding,
    explodedBy: isExplodingMessage ? message.explodedBy : undefined,
    explodesAt: isExplodingMessage ? message.explodingTime : 0,
    forceExplodingRetainer: isExplodingMessage ? !!message.explodingUnreadable : false,
    hasBeenEdited,
    hasCoinFlip,
    hasReactions,
    hasUnfurlList,
    hasUnfurlPrompts,
    isEditing: editing === ordinal,
    messageKey: isExplodingMessage ? Chat.getMessageKey(message) : '',
    reactionOrder,
    reactions,
    replyTo,
    sendIndicatorFailed:
      (message.type === 'text' || message.type === 'attachment') && message.submitState === 'failed',
    sendIndicatorID: message.timestamp,
    sendIndicatorSent:
      (message.type !== 'text' && message.type !== 'attachment') || !message.submitState || message.exploded,
    submitState,
    shouldShowPopup,
    showCenteredHighlight,
    showCoinsIcon,
    showExplodingCountdown,
    showReplyTo,
    showRevoked,
    showSendIndicator,
    text,
    textType,
    type,
  }
}

// Combined selector hook that fetches all common wrapper data in a single subscription.
export const useMessageData = (ordinal: T.Chat.Ordinal, isCenteredHighlight?: boolean) => {
  const you = useCurrentUserState(s => s.username)

  return Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal) ?? missingMessage
      return getCommonMessageData({
        accountsInfoMap: s.accountsInfoMap,
        editing: s.editing,
        isCenteredHighlight,
        message,
        messageCenterOrdinal: s.messageCenterOrdinal,
        ordinal,
        paymentStatusMap: Chat.useChatState.getState().paymentStatusMap,
        reactionOrderMap: s.reactionOrderMap,
        unfurlPrompt: s.unfurlPrompt,
        you,
      })
    })
  )
}

const useMessageDataWithMessage = (ordinal: T.Chat.Ordinal, isCenteredHighlight?: boolean) => {
  const you = useCurrentUserState(s => s.username)

  return Chat.useChatContext(
    C.useShallow(s => {
      const message = s.messageMap.get(ordinal) ?? missingMessage
      return {
        ...getCommonMessageData({
          accountsInfoMap: s.accountsInfoMap,
          editing: s.editing,
          isCenteredHighlight,
          message,
          messageCenterOrdinal: s.messageCenterOrdinal,
          ordinal,
          paymentStatusMap: Chat.useChatState.getState().paymentStatusMap,
          reactionOrderMap: s.reactionOrderMap,
          unfurlPrompt: s.unfurlPrompt,
          you,
        }),
        message,
      }
    })
  )
}

const useWrapperPopup = (
  ordinal: T.Chat.Ordinal,
  data: Pick<ReturnType<typeof useMessageData>, 'shouldShowPopup' | 'type'>
) => {
  const {type, shouldShowPopup} = data

  const shouldShow = () => {
    return messageShowsPopup(type) && shouldShowPopup
  }
  const {showPopup, showingPopup, popup, popupAnchor} = useMessagePopup({
    ordinal,
    shouldShow,
    style: styles.messagePopupContainer,
  })
  return {popup, popupAnchor, showPopup, showingPopup}
}

export const useWrapperMessage = (ordinal: T.Chat.Ordinal, isCenteredHighlight?: boolean) => {
  const messageData = useMessageData(ordinal, isCenteredHighlight)
  return {...useWrapperPopup(ordinal, messageData), messageData}
}

export const useWrapperMessageWithMessage = (ordinal: T.Chat.Ordinal, isCenteredHighlight?: boolean) => {
  const messageData = useMessageDataWithMessage(ordinal, isCenteredHighlight)
  return {...useWrapperPopup(ordinal, messageData), messageData}
}

type WrapperMessageProps = {
  children: React.ReactNode
  bottomChildren?: React.ReactNode
  showPopup: () => void
  showingPopup: boolean
  popup: React.ReactNode
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
  messageData: ReturnType<typeof useMessageData>
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
  canShowReactionsPopup: boolean
  children: React.ReactNode
  decorate: boolean
  ecrType: EditCancelRetryType
  exploding: boolean
  exploded: boolean
  explodedBy?: string
  explodesAt: number
  forceExplodingRetainer: boolean
  hasBeenEdited: boolean
  hasReactions: boolean
  hasUnfurlList: boolean
  isHighlighted: boolean
  messageKey: string
  ordinal: T.Chat.Ordinal
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
  reactionOrder?: ReadonlyArray<string>
  reactions?: T.Chat.Reactions
  sendIndicatorFailed: boolean
  sendIndicatorID: number
  sendIndicatorSent: boolean
  setShowingPicker: (s: boolean) => void
  shouldShowPopup: boolean
  showCoinsIcon: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showSendIndicator: boolean
  showingPicker: boolean
  showingPopup: boolean
  showPopup: () => void
  submitState?: T.Chat.Message['submitState']
  type: T.Chat.MessageType
}

const NormalWrapper = ({
  children,
  style,
}: {
  children: React.ReactNode
  style: Kb.Styles.StylesCrossPlatform
}) => {
  return (
    <Kb.Box2 direction="vertical" flex={1} relative={true} style={style} fullWidth={!Kb.Styles.isMobile}>
      {children}
    </Kb.Box2>
  )
}

function TextAndSiblings(p: TSProps) {
  const {botname, bottomChildren, canShowReactionsPopup, children, decorate, hasBeenEdited, hasUnfurlList, isHighlighted} = p
  const {showingPopup, ecrType, exploding, exploded, explodedBy, explodesAt, forceExplodingRetainer} = p
  const {hasReactions, popupAnchor, reactionOrder, reactions, sendIndicatorFailed, sendIndicatorID} = p
  const {sendIndicatorSent, type, setShowingPicker, showCoinsIcon, shouldShowPopup} = p
  const {showPopup, showExplodingCountdown, showRevoked, showSendIndicator, showingPicker, submitState} = p
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
      <ExplodingHeightRetainer
        explodedBy={explodedBy}
        exploding={exploding}
        messageKey={p.messageKey}
        retainHeight={forceExplodingRetainer || exploded}
      >
        {children as React.ReactElement}
      </ExplodingHeightRetainer>
    </Kb.Box2>
  ) : (
    children
  )

  return (
    <LongPressable {...pressableProps}>
      <Kb.Box2 direction="vertical" flex={1} relative={true} style={styles.middle} fullWidth={!Kb.Styles.isMobile}>
        <NormalWrapper style={styles.background}>
          {content}
          <BottomSide
            ecrType={ecrType}
            hasBeenEdited={hasBeenEdited}
            hasUnfurlList={hasUnfurlList}
            messageType={type}
            hasReactions={hasReactions}
            ordinal={p.ordinal}
            bottomChildren={bottomChildren}
            canShowReactionsPopup={canShowReactionsPopup}
            reactionOrder={reactionOrder}
            reactions={reactions}
            setShowingPicker={setShowingPicker}
            showingPopup={showingPopup}
          />
        </NormalWrapper>
      </Kb.Box2>
      <RightSide
        shouldShowPopup={shouldShowPopup}
        botname={botname}
        explodesAt={explodesAt}
        exploded={exploded}
        exploding={exploding}
        messageKey={p.messageKey}
        sendIndicatorFailed={sendIndicatorFailed}
        sendIndicatorID={sendIndicatorID}
        sendIndicatorSent={sendIndicatorSent}
        showSendIndicator={showSendIndicator}
        showExplodingCountdown={showExplodingCountdown}
        showRevoked={showRevoked}
        showCoinsIcon={showCoinsIcon}
        showPopup={showPopup}
        popupAnchor={popupAnchor}
        submitState={submitState}
      />
    </LongPressable>
  )
}

// Author
enum EditCancelRetryType {
  NONE,
  NOACTION,
  CANCEL,
  EDIT_CANCEL,
  RETRY_CANCEL,
}
function EditCancelRetry(p: {ecrType: EditCancelRetryType}) {
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
  const onCancel = () => {
    messageDelete(ordinal)
  }
  const onEdit = () => {
    setEditing(ordinal)
  }
  const onRetry = () => {
    outboxID && messageRetry(outboxID)
  }

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
            <Kb.Icon fontSize={16} type="iconfont-block" />{' '}
          </>
        ) : null}
        {`${failureDescription}. `}
      </Kb.Text>
      {action}
      {or}
      {cancel}
    </Kb.Text>
  )
}

type BProps = {
  showingPopup: boolean
  setShowingPicker: (s: boolean) => void
  bottomChildren?: React.ReactNode
  canShowReactionsPopup: boolean
  hasBeenEdited: boolean
  hasReactions: boolean
  hasUnfurlList: boolean
  messageType: T.Chat.MessageType
  ordinal: T.Chat.Ordinal
  reactionOrder?: ReadonlyArray<string>
  reactions?: T.Chat.Reactions
  ecrType: EditCancelRetryType
}
// reactions
function BottomSide(p: BProps) {
  const {showingPopup, setShowingPicker, bottomChildren, canShowReactionsPopup, ecrType, hasBeenEdited} = p
  const {hasReactions, hasUnfurlList, messageType, ordinal, reactionOrder, reactions} = p
  const {setReplyTo, toggleMessageReaction} = Chat.useChatContext(s => s.dispatch)

  const onReact = (emoji: string) => {
    toggleMessageReaction(ordinal, emoji)
  }
  const onReply = () => {
    setReplyTo(ordinal)
  }

  const reactionsRow = hasReactions ? (
    <ReactionsRow
      hasUnfurls={hasUnfurlList}
      messageType={messageType}
      onReact={onReact}
      onReply={onReply}
      reactionOrder={reactionOrder}
      reactions={reactions}
    />
  ) : null

  const canShowDesktopReactionsPopup = !C.isMobile && !hasReactions && canShowReactionsPopup
  const desktopReactionsPopup =
    canShowDesktopReactionsPopup && !showingPopup ? (
      <EmojiRow
        className={Kb.Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
        hasUnfurls={hasUnfurlList}
        messageType={messageType}
        onReact={onReact}
        onReply={onReply}
        onShowingEmojiPicker={setShowingPicker}
        style={styles.emojiRow}
      />
    ) : null

  const edited = useEdited(hasBeenEdited)

  return (
    <>
      {edited}
      {bottomChildren ?? null}
      {ecrType !== EditCancelRetryType.NONE ? <EditCancelRetry ecrType={ecrType} /> : null}
      {reactionsRow}
      {desktopReactionsPopup}
    </>
  )
}

// Exploding, ... , sending, tombstone
type RProps = {
  showPopup: () => void
  showSendIndicator: boolean
  showExplodingCountdown: boolean
  showRevoked: boolean
  showCoinsIcon: boolean
  botname: string
  exploded: boolean
  exploding: boolean
  explodesAt: number
  messageKey: string
  shouldShowPopup: boolean
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
  sendIndicatorFailed: boolean
  sendIndicatorID: number
  sendIndicatorSent: boolean
  submitState?: T.Chat.Message['submitState']
}
function RightSide(p: RProps) {
  const {showPopup, showSendIndicator, showCoinsIcon, popupAnchor} = p
  const {showExplodingCountdown, showRevoked, botname, shouldShowPopup} = p
  const sendIndicator = showSendIndicator ? (
    <SendIndicator
      failed={p.sendIndicatorFailed}
      id={p.sendIndicatorID}
      isExploding={p.exploding}
      sent={p.sendIndicatorSent}
    />
  ) : null

  const explodingCountdown = showExplodingCountdown ? (
    <ExplodingMeta
      exploded={p.exploded}
      exploding={p.exploding}
      explodesAt={p.explodesAt}
      messageKey={p.messageKey}
      onClick={showPopup}
      submitState={p.submitState}
    />
  ) : null

  const revokedIcon = showRevoked ? (
    <Kb.Box2 direction="vertical" tooltip="Revoked device" className="tooltip-bottom-left">
      <Kb.Icon type="iconfont-rip" color={Kb.Styles.globalColors.black_35} />
    </Kb.Box2>
  ) : null

  const coinsIcon = showCoinsIcon ? <Kb.ImageIcon type="icon-stellar-coins-stacked-16" /> : null

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
        <Kb.Box2 direction="vertical" style={styles.ellipsis}>
          <Kb.Icon type="iconfont-ellipsis" onClick={showPopup} />
        </Kb.Box2>
      </Kb.Box2>
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
        ref={popupAnchor}
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
}

export function WrapperMessage(p: WrapperMessageProps) {
  const {ordinal, bottomChildren, children, messageData: mdata} = p
  const {showPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)

  const {decorate, type, hasReactions, isEditing, shouldShowPopup} = mdata
  const {canShowReactionsPopup, ecrType, exploded, explodesAt, forceExplodingRetainer, messageKey} = mdata
  const {reactionOrder, reactions, sendIndicatorFailed, sendIndicatorID, sendIndicatorSent, submitState} = mdata
  const {showSendIndicator, showRevoked, showExplodingCountdown, exploding} = mdata
  const {showCoinsIcon, botname, hasBeenEdited, hasUnfurlList, showCenteredHighlight} = mdata

  const isHighlighted = showCenteredHighlight || isEditing
  const tsprops = {
    botname,
    bottomChildren,
    canShowReactionsPopup,
    children,
    decorate,
    ecrType,
    exploded,
    exploding,
    explodedBy: mdata.explodedBy,
    explodesAt,
    forceExplodingRetainer,
    hasBeenEdited,
    hasReactions,
    hasUnfurlList,
    isHighlighted,
    messageKey,
    ordinal,
    popupAnchor,
    reactionOrder,
    reactions,
    sendIndicatorFailed,
    sendIndicatorID,
    sendIndicatorSent,
    setShowingPicker,
    shouldShowPopup,
    showCoinsIcon,
    showExplodingCountdown,
    showPopup,
    showRevoked,
    showSendIndicator,
    showingPicker,
    showingPopup,
    submitState,
    type,
  }

  const messageContext = {isHighlighted: showCenteredHighlight, ordinal}

  return (
    <MessageContext value={messageContext}>
      <Kb.Box2 direction="vertical" relative={true} fullWidth={true}>
        <AuthorHeader ordinal={ordinal} />
        <TextAndSiblings {...tsprops} />
      </Kb.Box2>
      {popup}
    </MessageContext>
  )
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Kb.Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          marginLeft: Kb.Styles.isMobile ? 48 : 56,
        },
        isElectron: {
          marginBottom: 0,
          marginTop: 0,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Kb.Styles.platformStyles({
        common: {position: 'absolute', top: 4},
        isElectron: {
          left: Kb.Styles.globalMargins.small,
          top: 4,
          zIndex: 2,
        },
        isMobile: {left: Kb.Styles.globalMargins.tiny},
      }),
      background: {
        alignSelf: 'stretch',
        flexShrink: 1,
      },
      botAlias: Kb.Styles.platformStyles({
        common: {color: Kb.Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
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
      fail: {color: Kb.Styles.globalColors.redDark},
      failExploding: {color: Kb.Styles.globalColors.black_50},
      failUnderline: {color: Kb.Styles.globalColors.redDark, textDecorationLine: 'underline'},
      messagePopupContainer: {marginRight: Kb.Styles.globalMargins.small},
      middle: {
        flexShrink: 1,
        paddingLeft: Kb.Styles.isMobile ? 48 : 56,
        paddingRight: 4,
      },
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
      usernameCrown: Kb.Styles.platformStyles({
        isElectron: {
          alignItems: 'baseline',
          marginRight: 48,
          position: 'relative',
          top: -2,
        },
        isMobile: {alignItems: 'center'},
      }),
    }) as const
)
