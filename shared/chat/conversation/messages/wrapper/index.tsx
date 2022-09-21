import * as Constants from '../../../../constants/chat2'
import * as Container from '../../../../util/container'
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import EmojiRow from '../react-button/emoji-row/container'
import ExplodingHeightRetainer from './exploding-height-retainer'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import MessagePopup from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import ReactionsRow from '../reactions-row/container'
import SendIndicator from './send-indicator'
import type * as Types from '../../../../constants/types/chat2'
import type AttachmentMessageType from '../attachment/container'
import type CoinFlipType from '../coinflip/container'
import type MessagePlaceholderType from '../placeholder/container'
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
import type TeamJourneyType from '../cards/team-journey/container'
import type TextMessageType from '../text/container'
import type UnfurlListType from './unfurl/unfurl-list/container'
import type UnfurlPromptListType from './unfurl/prompt-list/container'
import {dismiss} from '../../../../util/keyboard'
import {formatTimeForChat} from '../../../../util/timestamp'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * row, and exploding meta tag.
 */

export type Props = {
  ordinal: Types.Ordinal
  conversationIDKey: Types.ConversationIDKey
  decorate: boolean
  exploded: boolean
  failureDescription: string
  forceAsh: boolean
  hasUnfurlPrompts: boolean
  isJoinLeave: boolean
  isLastInThread: boolean
  isPendingPayment: boolean
  isRevoked: boolean
  showCoinsIcon: boolean
  showUsername: string
  measure?: () => void
  message: Types.Message
  onAuthorClick: () => void
  onCancel?: () => void
  onEdit?: () => void
  onRetry?: () => void
  onSwipeLeft?: () => void
  orangeLineAbove: boolean
  previous?: Types.Message
  shouldShowPopup: boolean
  showCrowns: boolean
  showSendIndicator: boolean
  youAreAuthor: boolean
}

const useGetLongPress = (
  p: Props,
  o: {
    showCenteredHighlight: boolean
    canFixOverdraw: boolean
    showingPopup: boolean
    toggleShowingPopup: () => void
    popupAnchor: React.MutableRefObject<React.Component<any, {}, any> | null>
    meta: Types.ConversationMeta
    message: Types.Message
  }
) => {
  const {isPendingPayment, decorate, onSwipeLeft, showUsername, orangeLineAbove} = p
  const {
    showCenteredHighlight,
    canFixOverdraw,
    showingPopup,
    toggleShowingPopup,
    popupAnchor,
    message,
    meta,
  } = o
  const [showMenuButton, setShowMenuButton] = React.useState(false)
  const [showingPicker, setShowingPicker] = React.useState(false)

  const authorAndContent = useAuthorAndContent(p, {
    canFixOverdraw,
    showCenteredHighlight,
    showMenuButton,
    setShowingPicker,
    toggleShowingPopup,
    showingPopup,
    meta,
    message,
  })

  const orangeLine = orangeLineAbove ? (
    <Kb.Box2
      key="orangeLine"
      direction="vertical"
      style={Styles.collapseStyles([styles.orangeLine, !showUsername && styles.orangeLineCompensationLeft])}
    />
  ) : null

  const children = (
    <>
      {authorAndContent}
      {orangeLine}
    </>
  )

  const dismissKeyboard = React.useCallback(() => dismiss(), [dismiss])
  const onMouseOver = React.useCallback(() => setShowMenuButton(true), [setShowMenuButton])

  if (Styles.isMobile) {
    return (
      <LongPressable
        onLongPress={decorate ? toggleShowingPopup : undefined}
        onPress={decorate ? dismissKeyboard : undefined}
        // @ts-ignore bad types
        onSwipeLeft={decorate ? onSwipeLeft : undefined}
        style={Styles.collapseStyles([
          styles.container,
          showCenteredHighlight && styles.centeredOrdinal,
          !showUsername && styles.containerNoUsername,
        ] as const)}
      >
        {children}
      </LongPressable>
    )
  }
  return (
    <LongPressable
      // @ts-ignore bad types
      className={Styles.classNames(
        {
          'WrapperMessage-author': showUsername,
          'WrapperMessage-centered': showCenteredHighlight,
          'WrapperMessage-decorated': decorate,
          'WrapperMessage-hoverColor': !isPendingPayment,
          'WrapperMessage-noOverflow': isPendingPayment,
          'WrapperMessage-systemMessage': message.type.startsWith('system'),
          active: showingPopup || showingPicker,
        },
        'WrapperMessage-hoverBox'
      )}
      onContextMenu={toggleShowingPopup}
      onMouseOver={onMouseOver}
      // attach popups to the message itself
      ref={popupAnchor as any}
    >
      {children}
    </LongPressable>
  )
}

const useMessageNode = (p: Props, o: {showCenteredHighlight: boolean; toggleShowingPopup: () => void}) => {
  const {message, youAreAuthor} = p
  const {showCenteredHighlight, toggleShowingPopup} = o
  switch (message.type) {
    case 'text': {
      const TextMessage = require('../text/container').default as typeof TextMessageType
      return <TextMessage isHighlighted={showCenteredHighlight} key="text" message={message} />
    }
    case 'attachment': {
      const AttachmentMessage = require('../attachment/container').default as typeof AttachmentMessageType
      return (
        <AttachmentMessage
          key="attachment"
          message={message}
          isHighlighted={showCenteredHighlight}
          toggleMessageMenu={toggleShowingPopup}
        />
      )
    }
    case 'requestPayment': {
      const PaymentMessage = require('../account-payment/container').default as typeof PaymentMessageType
      return <PaymentMessage key="requestPayment" message={message} />
    }
    case 'sendPayment': {
      const PaymentMessage = require('../account-payment/container').default as typeof PaymentMessageType
      return <PaymentMessage key="sendPayment" message={message} />
    }
    case 'placeholder': {
      const MessagePlaceholder = require('../placeholder/container').default as typeof MessagePlaceholderType
      return <MessagePlaceholder key="placeholder" message={message} />
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
    case 'journeycard': {
      const TeamJourney = require('../cards/team-journey/container').default as typeof TeamJourneyType
      return <TeamJourney key="journey" message={message} />
    }
    case 'deleted':
      return null
    default:
      return null
  }
}

const useHighlightMode = (o: {ordinal: Types.Ordinal; conversationIDKey: Types.ConversationIDKey}) => {
  const {ordinal, conversationIDKey} = o
  const centeredOrdinalInfo = Container.useSelector(state =>
    state.chat2.messageCenterOrdinals.get(conversationIDKey)
  )
  const centeredOrdinal =
    centeredOrdinalInfo?.ordinal === ordinal ? centeredOrdinalInfo?.highlightMode : 'none'
  const [disableCenteredHighlight, setDisableCenteredHighlight] = React.useState(false)
  const timeoutIDRef = React.useRef<any>(null)
  const updateHighlightMode = React.useCallback(() => {
    switch (centeredOrdinal) {
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
  }, [setDisableCenteredHighlight])

  React.useEffect(() => {
    return () => {
      clearTimeout(timeoutIDRef.current)
    }
  })

  React.useEffect(() => {
    updateHighlightMode()
  }, [])

  const prevCenteredOrdinal = Container.usePrevious(centeredOrdinal)
  if (prevCenteredOrdinal !== centeredOrdinal) {
    updateHighlightMode()
  }

  return !disableCenteredHighlight && centeredOrdinal !== 'none'
}

const useBottomComponents = (
  p: Props,
  o: {
    showCenteredHighlight: boolean
    showMenuButton: boolean
    setShowingPicker: (s: boolean) => void
    toggleShowingPopup: () => void
    showingPopup: boolean
    authorIsBot: boolean
  }
) => {
  const {message} = p
  const {isPendingPayment, failureDescription, onCancel, onEdit, onRetry, exploded, hasUnfurlPrompts} = p
  const {conversationIDKey, measure} = p
  const {
    showCenteredHighlight,
    showMenuButton,
    setShowingPicker,
    toggleShowingPopup,
    showingPopup,
    authorIsBot,
  } = o
  const hasReactions = !!message.reactions?.size || isPendingPayment
  const isExploding = (message.type === 'text' || message.type === 'attachment') && message.exploding

  const messageAndButtons = useMessageAndButtons(p, {
    showMenuButton,
    setShowingPicker,
    hasReactions,
    showCenteredHighlight,
    isExploding,
    toggleShowingPopup,
    showingPopup,
    authorIsBot,
  })

  const isEdited = message.hasBeenEdited ? (
    <Kb.Text
      key="isEdited"
      type="BodyTiny"
      style={Styles.collapseStyles([styles.edited, showCenteredHighlight && styles.editedHighlighted])}
    >
      EDITED
    </Kb.Text>
  ) : null

  // hide error messages if the exploding message already exploded
  const isFailed =
    !!failureDescription && !(isExploding && exploded) ? (
      <Kb.Text key="isFailed" type="BodySmall">
        <Kb.Text type="BodySmall" style={isExploding ? styles.failExploding : styles.fail}>
          {isExploding && (
            <>
              <Kb.Icon fontSize={16} boxStyle={styles.failExplodingIcon} type="iconfont-block" />{' '}
            </>
          )}
          {failureDescription}.{' '}
        </Kb.Text>
        {!!onCancel && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onCancel}>
            Cancel
          </Kb.Text>
        )}
        {!!onCancel && (!!onEdit || !!onRetry) && <Kb.Text type="BodySmall"> or </Kb.Text>}
        {!!onEdit && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onEdit}>
            Edit
          </Kb.Text>
        )}
        {!!onRetry && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={onRetry}>
            Retry
          </Kb.Text>
        )}
      </Kb.Text>
    ) : null

  const unfurlPrompts = (() => {
    if (hasUnfurlPrompts) {
      const UnfurlPromptList = require('./unfurl/prompt-list/container')
        .default as typeof UnfurlPromptListType
      return (
        <UnfurlPromptList
          key="UnfurlPromptList"
          conversationIDKey={conversationIDKey}
          ordinal={message.ordinal}
        />
      )
    }
    return null
  })()

  const unfurlList = (() => {
    const UnfurlList = require('./unfurl/unfurl-list/container').default as typeof UnfurlListType
    if (message.type === 'text' && message.unfurls && !!message.unfurls.size) {
      return (
        <UnfurlList
          key="UnfurlList"
          conversationIDKey={conversationIDKey}
          ordinal={message.ordinal}
          toggleMessagePopup={toggleShowingPopup}
        />
      )
    }
    return null
  })()

  const coinFlip = (() => {
    if (message.type === 'text' && !!message.flipGameID) {
      const CoinFlip = require('../coinflip/container').default as typeof CoinFlipType
      return (
        <CoinFlip
          key="CoinFlip"
          conversationIDKey={conversationIDKey}
          flipGameID={message.flipGameID}
          measure={measure}
          isSendError={!!message.errorReason}
          text={message.text}
        />
      )
    }
    return null
  })()

  const reactionsRow = hasReactions ? (
    <ReactionsRow
      key="ReactionsRow"
      btnClassName="WrapperMessage-emojiButton"
      newBtnClassName="WrapperMessage-newEmojiButton"
      conversationIDKey={conversationIDKey}
      ordinal={message.ordinal}
    />
  ) : null

  if (!messageAndButtons) return null

  return message.type === 'journeycard' ? (
    <></>
  ) : (
    <>
      {messageAndButtons}
      {isEdited}
      {isFailed}
      {unfurlPrompts}
      {unfurlList}
      {coinFlip}
      {reactionsRow}
    </>
  )
}

const useAuthorAndContent = (
  p: Props,
  o: {
    canFixOverdraw: boolean
    showCenteredHighlight: boolean
    showMenuButton: boolean
    showingPopup: boolean
    setShowingPicker: (s: boolean) => void
    toggleShowingPopup: () => void
    meta: Types.ConversationMeta
    message: Types.Message
  }
) => {
  const {showUsername, isPendingPayment} = p
  const {onAuthorClick, youAreAuthor, showCrowns, conversationIDKey} = p
  const {
    showCenteredHighlight,
    canFixOverdraw,
    showMenuButton,
    setShowingPicker,
    toggleShowingPopup,
    showingPopup,
    meta,
    message,
  } = o

  const {author} = message
  const {teamID, teamname, teamType, botAliases} = meta

  const botAlias = botAliases[author] ?? ''

  const authorRoleInTeam = Container.useSelector(
    state => state.teams.teamIDToMembers.get(teamID)?.get(author)?.type
  )

  const authorIsBot = Container.useSelector(state => {
    const participantInfoNames = Constants.getParticipantInfo(state, conversationIDKey).name
    return teamname
      ? authorRoleInTeam === 'restrictedbot' || authorRoleInTeam === 'bot'
      : teamType === 'adhoc' && participantInfoNames.length > 0 // teams without info may have type adhoc with an empty participant name list
      ? !participantInfoNames.includes(author) // if adhoc, check if author in participants
      : false // if we don't have team information, don't show bot icon
  })

  const authorIsOwner = authorRoleInTeam === 'owner'
  const authorIsAdmin = authorRoleInTeam === 'admin'

  const children = useBottomComponents(p, {
    showCenteredHighlight,
    showMenuButton,
    setShowingPicker,
    toggleShowingPopup,
    showingPopup,
    authorIsBot,
  })

  if (message.type === 'journeycard') {
    const TeamJourney = require('../cards/team-journey/container').default as typeof TeamJourneyType
    return <TeamJourney key="journey" message={message} />
  }

  if (!showUsername) {
    return isPendingPayment ? (
      <PendingPaymentBackground key="pendingBackground">{children}</PendingPaymentBackground>
    ) : (
      children
    )
  }

  const username = (
    <Kb.ConnectedUsernames
      colorBroken={true}
      colorFollowing={true}
      colorYou={true}
      onUsernameClicked={onAuthorClick}
      fixOverdraw={canFixOverdraw}
      style={showCenteredHighlight && youAreAuthor ? styles.usernameHighlighted : undefined}
      type="BodySmallBold"
      usernames={showUsername}
      virtualText={true}
    />
  )

  const botAliasOrUsername = botAlias ? (
    <Kb.Box2 direction="horizontal">
      <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1}>
        {botAlias}
      </Kb.Text>
      <Kb.Text type="BodySmallBold" style={{color: Styles.globalColors.black}}>
        &nbsp;[
      </Kb.Text>
      {username}
      <Kb.Text type="BodySmallBold" style={{color: Styles.globalColors.black}}>
        ]
      </Kb.Text>
    </Kb.Box2>
  ) : (
    username
  )

  const ownerAdminTooltipIcon =
    showCrowns && (authorIsOwner || authorIsAdmin) ? (
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

  const content = (
    <React.Fragment key="authorAndContent">
      <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
        <Kb.Avatar
          size={32}
          username={showUsername}
          skipBackground={true}
          onClick={onAuthorClick}
          style={styles.avatar}
        />
        <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.usernameCrown}>
          {botAliasOrUsername}
          {ownerAdminTooltipIcon}
          {botIcon}
          <Kb.Text
            type="BodyTiny"
            fixOverdraw={canFixOverdraw}
            virtualText={true}
            style={Styles.collapseStyles([showCenteredHighlight && styles.timestampHighlighted])}
          >
            {formatTimeForChat(message.timestamp)}
          </Kb.Text>
        </Kb.Box2>
      </Kb.Box2>
      <Kb.Box2 key="content" direction="vertical" fullWidth={true} style={styles.contentUnderAuthorContainer}>
        {children}
      </Kb.Box2>
    </React.Fragment>
  )

  return isPendingPayment ? (
    <PendingPaymentBackground key="pendingBackground">{content}</PendingPaymentBackground>
  ) : (
    content
  )
}

const useMessageAndButtons = (
  p: Props,
  o: {
    showMenuButton: boolean
    setShowingPicker: (s: boolean) => void
    hasReactions: boolean
    showCenteredHighlight: boolean
    isExploding: boolean
    toggleShowingPopup: () => void
    showingPopup: boolean
    authorIsBot: boolean
  }
) => {
  const {measure, showCoinsIcon, message, forceAsh, isRevoked, conversationIDKey} = p
  const {decorate, isLastInThread, showSendIndicator, showUsername, shouldShowPopup} = p
  const {setShowingPicker, hasReactions, showMenuButton, isExploding, showingPopup} = o
  const {authorIsBot, showCenteredHighlight, toggleShowingPopup} = o
  const showMenuButton2 = !Styles.isMobile && showMenuButton

  const keyedBot = (message.type === 'text' && message.botUsername) || ''

  const sent =
    (message.type !== 'text' && message.type !== 'attachment') || !message.submitState || message.exploded
  const failed =
    (message.type === 'text' || message.type === 'attachment') && message.submitState === 'failed'
  const isShowingIndicator = !sent || failed

  const cachedMenuStylesRef = React.useRef(new Map<string, Styles.StylesCrossPlatform>())
  const menuAreaStyle = (exploded: boolean, exploding: boolean) => {
    const commonWidth = 20
    const iconSizes = [
      isRevoked ? commonWidth : 0, // revoked
      showCoinsIcon ? commonWidth : 0, // coin stack
      exploded || Styles.isMobile ? 0 : 16, // ... menu
      exploding ? (Styles.isMobile ? commonWidth : 20) : commonWidth, // exploding or gutter
      keyedBot && !authorIsBot ? commonWidth : 0,
    ].filter(Boolean)
    const padding = Styles.globalMargins.tiny
    const width =
      iconSizes.length <= 0 ? 0 : iconSizes.reduce((total, size) => total + size, iconSizes.length * padding)

    const key = `${width}:${showUsername ? 1 : 0}:${exploding ? 1 : 0}:${exploded ? 1 : 0}`

    if (!cachedMenuStylesRef.current.has(key)) {
      cachedMenuStylesRef.current.set(
        key,
        Styles.collapseStyles([
          styles.menuButtons,
          !exploded && {width},
          !!showUsername && styles.menuButtonsWithAuthor,
        ])
      )
    }
    return cachedMenuStylesRef.current.get(key)
  }

  const messageNode = useMessageNode(p, {showCenteredHighlight, toggleShowingPopup})

  let exploded = false
  let explodedBy = ''
  switch (message.type) {
    case 'text':
      exploded = message.exploded
      explodedBy = message.explodedBy
      break
    case 'attachment':
      exploded = message.exploded
      explodedBy = message.explodedBy
      break
    default:
  }
  const exploding = isExploding
  const maybeExplodedChild = exploding ? (
    <ExplodingHeightRetainer
      explodedBy={explodedBy}
      exploding={exploding}
      measure={measure}
      messageKey={Constants.getMessageKey(message)}
      retainHeight={forceAsh || exploded}
    >
      {messageNode}
    </ExplodingHeightRetainer>
  ) : (
    messageNode
  )

  // We defer mounting the menu buttons since they are expensive and only show up on hover on desktop and not at all on mobile
  // but this creates complexity as we can't use box2 gap stuff since we can either
  // 1. Haven't mounted it yet
  // 2. Have mounted but its hidden w/ css
  // TODO cleaner way to do this, or speedup react button maybe
  if (decorate && !exploded) {
    const sendIndicator = showSendIndicator ? (
      <SendIndicator
        key="sendIndicator"
        sent={sent}
        failed={failed}
        id={message.timestamp}
        isExploding={isExploding}
        style={styles.send}
      />
    ) : null
    const explodingMeta =
      exploding && !isShowingIndicator ? (
        <ExplodingMeta
          conversationIDKey={conversationIDKey}
          isParentHighlighted={showCenteredHighlight}
          onClick={toggleShowingPopup}
          ordinal={message.ordinal}
        />
      ) : null
    const revokedIcon = isRevoked ? (
      <Kb.WithTooltip tooltip="Revoked device">
        <Kb.Icon type="iconfont-rip" style={styles.paddingLeftTiny} color={Styles.globalColors.black_35} />
      </Kb.WithTooltip>
    ) : null
    const bot =
      keyedBot && !authorIsBot ? (
        <Kb.WithTooltip tooltip={`Encrypted for @${keyedBot}`}>
          <Kb.Icon
            color={Styles.globalColors.black_35}
            type="iconfont-bot"
            onClick={() => null}
            style={styles.paddingLeftTiny}
          />
        </Kb.WithTooltip>
      ) : null

    const showMenu = showMenuButton2 ? (
      <Kb.Box className="WrapperMessage-buttons">
        {!hasReactions && Constants.isMessageWithReactions(message) && !showingPopup && (
          <EmojiRow
            className="WrapperMessage-emojiButton"
            conversationIDKey={conversationIDKey}
            onShowingEmojiPicker={setShowingPicker}
            ordinal={message.ordinal}
            tooltipPosition={isLastInThread ? 'top center' : 'bottom center'}
            style={Styles.collapseStyles([styles.emojiRow, isLastInThread && styles.emojiRowLast] as const)}
          />
        )}
        <Kb.Box>
          {shouldShowPopup && (
            <Kb.WithTooltip tooltip="More actions..." toastStyle={styles.moreActionsTooltip}>
              <Kb.Box style={styles.ellipsis}>
                <Kb.Icon type="iconfont-ellipsis" onClick={toggleShowingPopup} />
              </Kb.Box>
            </Kb.WithTooltip>
          )}
        </Kb.Box>
      </Kb.Box>
    ) : null
    const coinsIcon = showCoinsIcon ? (
      <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.paddingLeftTiny} />
    ) : null

    return (
      <Kb.Box2 key="messageAndButtons" direction="horizontal" fullWidth={true}>
        {maybeExplodedChild}
        <Kb.Box2 direction="horizontal" style={menuAreaStyle(exploded, exploding)}>
          {sendIndicator}
          {explodingMeta}
          {revokedIcon}
          {coinsIcon}
          {bot}
          {showMenu}
        </Kb.Box2>
      </Kb.Box2>
    )
  } else if (exploding) {
    // extra box so the hierarchy stays the same when exploding or you'll remount
    return (
      <Kb.Box2 key="messageAndButtons" direction="horizontal" fullWidth={true}>
        {maybeExplodedChild}
        <Kb.Box2 direction="horizontal" style={menuAreaStyle(exploded, exploding)}>
          <ExplodingMeta
            conversationIDKey={conversationIDKey}
            isParentHighlighted={showCenteredHighlight}
            onClick={toggleShowingPopup}
            ordinal={message.ordinal}
          />
        </Kb.Box2>
      </Kb.Box2>
    )
  } else {
    return maybeExplodedChild
  }
}

const messageShowsPopup = (type: Types.Message['type']) =>
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

const WrapperMessage = (p: Props) => {
  const {isPendingPayment, orangeLineAbove, conversationIDKey, ordinal} = p
  const message = Container.useSelector(
    state => Constants.getMessage(state, conversationIDKey, ordinal) || missingMessage
  )
  const meta = Container.useSelector(state => Constants.getMeta(state, conversationIDKey))
  const {measure, shouldShowPopup} = p
  const {type} = message
  const showCenteredHighlight = useHighlightMode({conversationIDKey, ordinal})
  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight
  const canFixOverdrawValue = React.useMemo(() => ({canFixOverdraw}), [canFixOverdraw])
  const {toggleShowingPopup, showingPopup, popup, popupAnchor} = Kb.usePopup(attachTo =>
    messageShowsPopup(type) && shouldShowPopup && showingPopup ? (
      <MessagePopup
        key="popup"
        attachTo={attachTo}
        message={message}
        onHidden={toggleShowingPopup}
        position="top right"
        style={styles.messagePopupContainer}
        visible={showingPopup}
      />
    ) : null
  )

  const prevMessage = Container.usePrevious(message)
  const prevOrange = Container.usePrevious(orangeLineAbove)
  if (measure && (message !== prevMessage || prevOrange !== orangeLineAbove)) {
    measure()
  }

  const longPressable = useGetLongPress(p, {
    canFixOverdraw,
    showCenteredHighlight,
    showingPopup,
    toggleShowingPopup,
    popupAnchor,
    message,
    meta,
  })

  if (!message) {
    return null
  }
  return (
    <Styles.StyleContext.Provider value={canFixOverdrawValue}>
      {longPressable}
      {popup}
    </Styles.StyleContext.Provider>
  )
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      authorContainer: Styles.platformStyles({
        common: {
          alignItems: 'flex-start',
          alignSelf: 'flex-start',
          height: Styles.globalMargins.mediumLarge,
        },
        isMobile: {marginTop: 8},
      }),
      avatar: Styles.platformStyles({
        isElectron: {marginLeft: Styles.globalMargins.small},
        isMobile: {marginLeft: Styles.globalMargins.tiny},
      }),
      botAlias: Styles.platformStyles({
        common: {color: Styles.globalColors.black},
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {maxWidth: 120},
      }),
      centeredOrdinal: {backgroundColor: Styles.globalColors.yellowOrYellowAlt},
      container: Styles.platformStyles({isMobile: {overflow: 'hidden'}}),
      containerNoUsername: Styles.platformStyles({
        isMobile: {
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
          paddingTop: 3,
        },
      }),
      contentUnderAuthorContainer: Styles.platformStyles({
        isElectron: {
          marginTop: -16,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.small + // left margin
            Styles.globalMargins.mediumLarge, // avatar
        },
        isMobile: {
          marginTop: -12,
          paddingBottom: 3,
          paddingLeft:
            // Space for below the avatar
            Styles.globalMargins.tiny + // right margin
            Styles.globalMargins.tiny + // left margin
            Styles.globalMargins.mediumLarge, // avatar
          paddingRight: Styles.globalMargins.tiny,
        },
      }),
      edited: {color: Styles.globalColors.black_20},
      editedHighlighted: {color: Styles.globalColors.black_20OrBlack},
      ellipsis: {
        marginLeft: Styles.globalMargins.tiny,
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
      emojiRowLast: Styles.platformStyles({isElectron: {top: -Styles.globalMargins.medium + 5}}),
      fail: {color: Styles.globalColors.redDark},
      failExploding: {color: Styles.globalColors.black_50},
      failExplodingIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          verticalAlign: 'middle',
        },
      }),
      failUnderline: {color: Styles.globalColors.redDark, textDecorationLine: 'underline'},
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
      menuButtonsWithAuthor: {marginTop: -16},
      messagePopupContainer: {marginRight: Styles.globalMargins.small},
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
      send: Styles.platformStyles({isElectron: {pointerEvents: 'none'}}),
      timestamp: Styles.platformStyles({
        isElectron: {
          flexShrink: 0,
          lineHeight: 19,
        },
      }),
      timestampHighlighted: {color: 'red' /*Styles.globalColors.black_50OrBlack_40*/},
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

export default WrapperMessage
