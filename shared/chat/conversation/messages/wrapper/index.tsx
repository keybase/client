import * as Kb from '../../../../common-adapters'
import * as Container from '../../../../util/container'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Constants from '../../../../constants/chat2'
import type * as Types from '../../../../constants/types/chat2'
import SystemCreateTeam from '../system-create-team/container'
import SystemAddedToTeam from '../system-added-to-team/container'
import SystemChangeRetention from '../system-change-retention/container'
import SystemGitPush from '../system-git-push/container'
import SystemInviteAccepted from '../system-invite-accepted/container'
import SystemJoined from '../system-joined/container'
import SystemLeft from '../system-left/container'
import SystemSBSResolved from '../system-sbs-resolve/container'
import SystemSimpleToComplex from '../system-simple-to-complex/container'
import SystemText from '../system-text/container'
import SystemUsersAddedToConv from '../system-users-added-to-conv/container'
import SystemChangeAvatar from '../system-change-avatar'
import SystemNewChannel from '../system-new-channel/container'
import SetDescription from '../set-description/container'
import Pin from '../pin'
import SetChannelname from '../set-channelname/container'
import TextMessage from '../text/container'
import AttachmentMessage from '../attachment/container'
import PaymentMessage from '../account-payment/container'
import MessagePlaceholder from '../placeholder/container'
import ExplodingHeightRetainer from './exploding-height-retainer'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import MessagePopup from '../message-popup'
import PendingPaymentBackground from '../account-payment/pending-background'
import EmojiRow from '../react-button/emoji-row/container'
import ReactionsRow from '../reactions-row/container'
import SendIndicator from './send-indicator'
import UnfurlList from './unfurl/unfurl-list/container'
import UnfurlPromptList from './unfurl/prompt-list/container'
import CoinFlip from '../coinflip/container'
import TeamJourney from '../cards/team-journey/container'
import {dismiss} from '../../../../util/keyboard'
import {formatTimeForChat} from '../../../../util/timestamp'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * row, and exploding meta tag.
 */

export type Props = {
  authorIsAdmin?: boolean
  authorIsOwner?: boolean
  authorIsBot?: boolean
  botAlias: string
  centeredOrdinal: Types.CenterOrdinalHighlightMode
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
} & Kb.OverlayParentProps

const useGetLongPress = (
  p: Props,
  o: {
    dismissKeyboard: () => void
    showCenteredHighlight: boolean
    showingPicker: boolean
    onMouseOver: () => void
  },
  children: React.ReactNode
) => {
  const {
    decorate,
    toggleShowingMenu,
    onSwipeLeft,
    showUsername,
    isPendingPayment,
    message,
    showingMenu,
    setAttachmentRef,
  } = p
  const {dismissKeyboard, showCenteredHighlight, showingPicker, onMouseOver} = o
  if (Styles.isMobile) {
    return (
      <LongPressable
        onLongPress={decorate ? toggleShowingMenu : undefined}
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
          active: showingMenu || showingPicker,
        },
        'WrapperMessage-hoverBox'
      )}
      onContextMenu={toggleShowingMenu}
      onMouseOver={onMouseOver}
      // attach popups to the message itself
      ref={setAttachmentRef}
    >
      {children}
    </LongPressable>
  )
}

const useMessageNode = (p: Props, o: {showCenteredHighlight: boolean}) => {
  const {message, toggleShowingMenu, youAreAuthor} = p
  const {showCenteredHighlight} = o
  switch (message.type) {
    case 'text':
      return <TextMessage isHighlighted={showCenteredHighlight} key="text" message={message} />
    case 'attachment':
      return (
        <AttachmentMessage
          key="attachment"
          message={message}
          isHighlighted={showCenteredHighlight}
          toggleMessageMenu={toggleShowingMenu}
        />
      )
    case 'requestPayment':
      return <PaymentMessage key="requestPayment" message={message} />
    case 'sendPayment':
      return <PaymentMessage key="sendPayment" message={message} />
    case 'placeholder':
      return <MessagePlaceholder key="placeholder" message={message} />
    case 'systemInviteAccepted':
      return <SystemInviteAccepted key="systemInviteAccepted" message={message} />
    case 'systemSBSResolved':
      if (youAreAuthor) {
        return <SystemSBSResolved key="systemSbsResolved" message={message} />
      } else {
        return (
          <SystemJoined
            key="systemJoined"
            message={{...message, joiners: [message.prover], leavers: [], type: 'systemJoined'}}
          />
        )
      }
    case 'systemSimpleToComplex':
      return <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
    case 'systemGitPush':
      return <SystemGitPush key="systemGitPush" message={message} />
    case 'systemCreateTeam':
      return <SystemCreateTeam key="systemCreateTeam" message={message} />
    case 'systemAddedToTeam':
      return <SystemAddedToTeam key="systemAddedToTeam" message={message} />
    case 'systemChangeRetention':
      return <SystemChangeRetention key="systemChangeRetention" message={message} />
    case 'systemUsersAddedToConversation':
      return <SystemUsersAddedToConv key="systemUsersAddedToConv" message={message} />
    case 'systemJoined':
      return <SystemJoined key="systemJoined" message={message} />
    case 'systemText':
      return <SystemText key="systemText" message={message} />
    case 'systemLeft':
      return <SystemLeft key="systemLeft" message={message} />
    case 'systemChangeAvatar':
      return <SystemChangeAvatar key="systemChangeAvatar" message={message} />
    case 'systemNewChannel':
      return <SystemNewChannel key="systemNewChannel" message={message} />
    case 'setDescription':
      return <SetDescription key="setDescription" message={message} />
    case 'pin':
      return (
        <Pin key="pin" conversationIDKey={message.conversationIDKey} messageID={message.pinnedMessageID} />
      )
    case 'setChannelname':
      // suppress this message for the #general channel, it is redundant.
      return message.newChannelname === 'general' ? null : (
        <SetChannelname key="setChannelname" message={message} />
      )
    case 'journeycard':
      return <TeamJourney key="journey" message={message} />
    case 'deleted':
      return null
    default:
      return null
  }
}

const useHighlightMode = (p: {
  centeredOrdinal: Types.CenterOrdinalHighlightMode
  mountedRef: React.MutableRefObject<boolean>
}) => {
  const [disableCenteredHighlight, setDisableCenteredHighlight] = React.useState(false)
  const {centeredOrdinal, mountedRef} = p
  const updateHighlightMode = React.useCallback(() => {
    switch (centeredOrdinal) {
      case 'flash':
        setDisableCenteredHighlight(false)
        // TODO fix timeout
        setTimeout(() => {
          if (mountedRef.current) {
            setDisableCenteredHighlight(true)
          }
        }, 2000)
        break
      case 'always':
        setDisableCenteredHighlight(false)
        break
    }
  }, [setDisableCenteredHighlight])

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
  o: {showCenteredHighlight: boolean; showMenuButton: boolean; setShowingPicker: (s: boolean) => void}
) => {
  const {message} = p
  const {isPendingPayment, failureDescription, onCancel, onEdit, onRetry, exploded, hasUnfurlPrompts} = p
  const {conversationIDKey, toggleShowingMenu, measure, shouldShowPopup} = p
  const {showCenteredHighlight, showMenuButton, setShowingPicker} = o

  const hasReactions = !!message.reactions?.size || isPendingPayment
  const isExploding = (message.type === 'text' || message.type === 'attachment') && message.exploding

  const messageNode = useMessageNode(p, {showCenteredHighlight})

  const messageAndButtons = useMessageAndButtons(
    p,
    {isExploding, showCenteredHighlight, shouldShowPopup, showMenuButton, setShowingPicker, hasReactions},
    messageNode
  )

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

  const unfurlPrompts = hasUnfurlPrompts ? (
    <UnfurlPromptList
      key="UnfurlPromptList"
      conversationIDKey={conversationIDKey}
      ordinal={message.ordinal}
    />
  ) : null

  const unfurlList =
    message.type === 'text' && message.unfurls && !!message.unfurls.size ? (
      <UnfurlList
        key="UnfurlList"
        conversationIDKey={conversationIDKey}
        ordinal={message.ordinal}
        toggleMessagePopup={toggleShowingMenu}
      />
    ) : null

  const coinFlip =
    message.type === 'text' && !!message.flipGameID ? (
      <CoinFlip
        key="CoinFlip"
        conversationIDKey={conversationIDKey}
        flipGameID={message.flipGameID}
        measure={measure}
        isSendError={!!message.errorReason}
        text={message.text}
      />
    ) : null

  const reactionsRow = hasReactions ? (
    <ReactionsRow
      key="ReactionsRow"
      btnClassName="WrapperMessage-emojiButton"
      newBtnClassName="WrapperMessage-newEmojiButton"
      conversationIDKey={conversationIDKey}
      ordinal={message.ordinal}
    />
  ) : null

  if (!messageNode) return null

  return message.type === 'journeycard'
    ? []
    : [messageAndButtons, isEdited, isFailed, unfurlPrompts, unfurlList, coinFlip, reactionsRow]
}

const useAuthorAndContent = (
  p: Props,
  o: {
    canFixOverdraw: boolean
    showCenteredHighlight: boolean
    showMenuButton: boolean
    setShowingPicker: (s: boolean) => void
  }
) => {
  const {showUsername, authorIsOwner, authorIsAdmin, authorIsBot, message} = p
  const {onAuthorClick, youAreAuthor, botAlias, showCrowns} = p
  const {showCenteredHighlight, canFixOverdraw, showMenuButton, setShowingPicker} = o
  const children = useBottomComponents(p, {showCenteredHighlight, showMenuButton, setShowingPicker})

  if (!showUsername) {
    children
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

  return (
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
}

const useMessageAndButtons = (
  p: Props,
  o: {
    shouldShowPopup: boolean
    showMenuButton: boolean
    setShowingPicker: (s: boolean) => void
    hasReactions: boolean
    showCenteredHighlight: boolean
    isExploding: boolean
  },
  children: React.ReactNode
) => {
  const {
    message,
    forceAsh,
    isRevoked,
    conversationIDKey,
    measure,
    showCoinsIcon,
    authorIsBot,
    toggleShowingMenu,
  } = p
  const {decorate, isLastInThread, showSendIndicator, showUsername, showingMenu} = p
  const {showMenuButton, isExploding, showCenteredHighlight, shouldShowPopup} = o
  const {setShowingPicker, hasReactions} = o
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
      {children}
    </ExplodingHeightRetainer>
  ) : (
    children
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

    return (
      <Kb.Box2 key="messageAndButtons" direction="horizontal" fullWidth={true}>
        {maybeExplodedChild}
        <Kb.Box2 direction="horizontal" style={menuAreaStyle(exploded, exploding)}>
          {sendIndicator}
          {exploding && !isShowingIndicator && (
            <ExplodingMeta
              conversationIDKey={conversationIDKey}
              isParentHighlighted={showCenteredHighlight}
              onClick={toggleShowingMenu}
              ordinal={message.ordinal}
            />
          )}
          {isRevoked && (
            <Kb.WithTooltip tooltip="Revoked device">
              <Kb.Icon
                type="iconfont-rip"
                style={styles.paddingLeftTiny}
                color={Styles.globalColors.black_35}
              />
            </Kb.WithTooltip>
          )}
          {showCoinsIcon && <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.paddingLeftTiny} />}
          {keyedBot && !authorIsBot && (
            <Kb.WithTooltip tooltip={`Encrypted for @${keyedBot}`}>
              <Kb.Icon
                color={Styles.globalColors.black_35}
                type="iconfont-bot"
                onClick={() => null}
                style={styles.paddingLeftTiny}
              />
            </Kb.WithTooltip>
          )}
          {showMenuButton2 ? (
            <Kb.Box className="WrapperMessage-buttons">
              {!hasReactions && Constants.isMessageWithReactions(message) && !showingMenu && (
                <EmojiRow
                  className="WrapperMessage-emojiButton"
                  conversationIDKey={conversationIDKey}
                  onShowingEmojiPicker={setShowingPicker}
                  ordinal={message.ordinal}
                  tooltipPosition={isLastInThread ? 'top center' : 'bottom center'}
                  style={Styles.collapseStyles([
                    styles.emojiRow,
                    isLastInThread && styles.emojiRowLast,
                  ] as const)}
                />
              )}
              <Kb.Box>
                {shouldShowPopup && (
                  <Kb.WithTooltip tooltip="More actions..." toastStyle={styles.moreActionsTooltip}>
                    <Kb.Box style={styles.ellipsis}>
                      <Kb.Icon type="iconfont-ellipsis" onClick={toggleShowingMenu} />
                    </Kb.Box>
                  </Kb.WithTooltip>
                )}
              </Kb.Box>
            </Kb.Box>
          ) : null}
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
            onClick={toggleShowingMenu}
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

const _WrapperMessage = (p: Props) => {
  const {message, centeredOrdinal, orangeLineAbove, showUsername} = p
  const {isPendingPayment} = p
  const {toggleShowingMenu, measure, shouldShowPopup} = p
  const {getAttachmentRef, showingMenu} = p

  const [showMenuButton, setShowMenuButton] = React.useState(false)
  const [showingPicker, setShowingPicker] = React.useState(false)

  const mountedRef = React.useRef(true)
  React.useEffect(() => {
    return () => {
      mountedRef.current = false
    }
  }, [])

  const showCenteredHighlight = useHighlightMode({centeredOrdinal, mountedRef})
  const onMouseOver = React.useCallback(() => setShowMenuButton(true), [setShowMenuButton])
  const canFixOverdraw = !isPendingPayment && !showCenteredHighlight
  const canFixOverdrawValue = React.useMemo(() => ({canFixOverdraw}), [canFixOverdraw])

  const dismissKeyboard = React.useCallback(() => dismiss(), [dismiss])

  const {type} = message
  const popup =
    messageShowsPopup(type) && shouldShowPopup && showingMenu ? (
      <MessagePopup
        key="popup"
        attachTo={getAttachmentRef}
        message={message}
        onHidden={toggleShowingMenu}
        position="top right"
        style={styles.messagePopupContainer}
        visible={showingMenu}
      />
    ) : null

  const prevMessage = Container.usePrevious(message)
  const prevOrange = Container.usePrevious(orangeLineAbove)
  if (measure && (message !== prevMessage || prevOrange !== orangeLineAbove)) {
    measure()
  }

  let authorAndContent = useAuthorAndContent(p, {
    canFixOverdraw,
    showCenteredHighlight,
    showMenuButton,
    setShowingPicker,
  })

  if (isPendingPayment) {
    authorAndContent = (
      <PendingPaymentBackground key="pendingBackground">{authorAndContent}</PendingPaymentBackground>
    )
  }

  const orangeLine = orangeLineAbove ? (
    <Kb.Box2
      key="orangeLine"
      direction="vertical"
      style={Styles.collapseStyles([styles.orangeLine, !showUsername && styles.orangeLineCompensationLeft])}
    />
  ) : null

  const longPressable = useGetLongPress(
    p,
    {
      dismissKeyboard,
      showCenteredHighlight,
      showingPicker,
      onMouseOver,
    },
    [
      message.type === 'journeycard' ? <TeamJourney key="journey" message={message} /> : authorAndContent,
      orangeLine,
    ]
  )

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

const WrapperMessage = Kb.OverlayParentHOC(_WrapperMessage)

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
