import * as C from '@/constants'
import * as Chat from '@/stores/chat'
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
import {useTeamsState} from '@/stores/teams'
import {useProfileState} from '@/stores/profile'
import {useTrackerState} from '@/stores/tracker'
import {formatTimeForChat} from '@/util/timestamp'

export type Props = {
  isCenteredHighlight?: boolean
  isLastMessage?: boolean
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
  const showUserProfile = useProfileState(s => s.dispatch.showUserProfile)
  const showUser = useTrackerState(s => s.dispatch.showUser)

  const onAuthorClick = () => {
    if (C.isMobile) {
      showUserProfile(showUsername)
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

// Pure helper functions - moved outside hooks to avoid recreating them per message
const getReactionsPopupPosition = (
  isLastMessage: boolean,
  hasReactions: boolean,
  message: T.Chat.Message
) => {
  if (C.isMobile) return 'none' as const
  if (hasReactions) return 'none' as const
  const validMessage = Chat.isMessageWithReactions(message)
  if (!validMessage) return 'none' as const
  return isLastMessage ? ('last' as const) : ('middle' as const)
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
export const useMessageData = (
  ordinal: T.Chat.Ordinal,
  isLastMessage = false,
  isCenteredHighlight = false
) => {
  const you = useCurrentUserState(s => s.username)

  return Chat.useChatContext(
    C.useShallow(s => {
      const accountsInfoMap = s.accountsInfoMap
      const m = s.messageMap.get(ordinal) ?? missingMessage
      const isEditing = s.editing === ordinal
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
      const reactionsPopupPosition = getReactionsPopupPosition(isLastMessage, hasReactions, m)
      const ecrType = getEcrType(m, you)
      const shouldShowPopup = Chat.shouldShowPopup(accountsInfoMap, m)
      // Fields lifted from child components to consolidate subscriptions
      const hasBeenEdited = m.hasBeenEdited ?? false
      const hasCoinFlip = m.type === 'text' && !!m.flipGameID
      const hasUnfurlList = (m.unfurls?.size ?? 0) > 0
      const hasUnfurlPrompts = !!id && !!s.unfurlPrompt.get(id)?.size
      const textType: 'error' | 'sent' | 'pending' = m.errorReason ? 'error' : !submitState ? 'sent' : 'pending'
      const showReplyTo = m.type === 'text' ? !!m.replyTo : false
      const text = m.type === 'text' ? (m.decoratedText?.stringValue() ?? m.text.stringValue()) : ''

      return {
        botname,
        decorate,
        ecrType,
        exploding,
        hasBeenEdited,
        hasCoinFlip,
        hasReactions,
        hasUnfurlList,
        hasUnfurlPrompts,
        isEditing,
        reactionsPopupPosition,
        shouldShowPopup,
        showCenteredHighlight: isCenteredHighlight,
        showCoinsIcon,
        showExplodingCountdown,
        showReplyTo,
        showRevoked,
        showSendIndicator,
        text,
        textType,
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

  const shouldShow = () => {
    return messageShowsPopup(type) && shouldShowPopup
  }
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

  const shouldShow = () => {
    return messageShowsPopup(type) && shouldShowPopup
  }
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
  hasBeenEdited: boolean
  hasReactions: boolean
  hasUnfurlList: boolean
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
    <Kb.Box2 direction="vertical" flex={1} relative={true} style={style} fullWidth={!Kb.Styles.isMobile}>
      {children}
    </Kb.Box2>
  )
}

function TextAndSiblings(p: TSProps) {
  const {botname, bottomChildren, children, decorate, hasBeenEdited, hasUnfurlList, isHighlighted} = p
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
  showPopup: () => void
  showingPopup: boolean
  setShowingPicker: (s: boolean) => void
  bottomChildren?: React.ReactNode
  hasBeenEdited: boolean
  hasReactions: boolean
  hasUnfurlList: boolean
  messageType: T.Chat.MessageType
  reactionsPopupPosition: 'none' | 'last' | 'middle'
  ecrType: EditCancelRetryType
}
// reactions
function BottomSide(p: BProps) {
  const {showingPopup, setShowingPicker, bottomChildren, ecrType, hasBeenEdited} = p
  const {hasReactions, hasUnfurlList, messageType, reactionsPopupPosition} = p

  const reactionsRow = hasReactions ? <ReactionsRow /> : null

  // this exists and is shown using css to avoid thrashing
  const desktopReactionsPopup =
    !C.isMobile && reactionsPopupPosition !== 'none' && !showingPopup ? (
      <EmojiRow
        className={Kb.Styles.classNames('WrapperMessage-emojiButton', 'hover-visible')}
        hasUnfurls={hasUnfurlList}
        messageType={messageType}
        onShowingEmojiPicker={setShowingPicker}
        style={reactionsPopupPosition === 'last' ? styles.emojiRowLast : styles.emojiRow}
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
  shouldShowPopup: boolean
  popupAnchor: React.RefObject<Kb.MeasureRef | null>
}
function RightSide(p: RProps) {
  const {showPopup, showSendIndicator, showCoinsIcon, popupAnchor} = p
  const {showExplodingCountdown, showRevoked, botname, shouldShowPopup} = p
  const sendIndicator = showSendIndicator ? <SendIndicator /> : null

  const explodingCountdown = showExplodingCountdown ? <ExplodingMeta onClick={showPopup} /> : null

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

export function WrapperMessage(p: WMProps) {
  const {ordinal, isCenteredHighlight = false, isLastMessage = false} = p
  const messageData = useMessageData(ordinal, isLastMessage, isCenteredHighlight)
  return <WrapperMessageView {...p} messageData={messageData} />
}

export function WrapperMessageView(p: WMProps & {messageData: ReturnType<typeof useMessageData>}) {
  const {ordinal, bottomChildren, children, messageData: mdataProp} = p
  const {showCenteredHighlight, showPopup, showingPopup, popup, popupAnchor} = p
  const [showingPicker, setShowingPicker] = React.useState(false)
  const mdata = mdataProp

  const {decorate, type, hasReactions, isEditing, shouldShowPopup} = mdata
  const {ecrType, showSendIndicator, showRevoked, showExplodingCountdown, exploding} = mdata
  const {reactionsPopupPosition, showCoinsIcon, botname, you, hasBeenEdited, hasUnfurlList} = mdata

  const isHighlighted = showCenteredHighlight || isEditing
  const tsprops = {
    botname,
    bottomChildren,
    children,
    decorate,
    ecrType,
    exploding,
    hasBeenEdited,
    hasReactions,
    hasUnfurlList,
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
