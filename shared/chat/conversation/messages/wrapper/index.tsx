import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import SystemAddedToTeam from '../system-added-to-team/container'
import SystemChangeRetention from '../system-change-retention/container'
import SystemGitPush from '../system-git-push/container'
import SystemInviteAccepted from '../system-invite-accepted/container'
import SystemJoined from '../system-joined/container'
import SystemLeft from '../system-left/container'
import SystemSimpleToComplex from '../system-simple-to-complex/container'
import SystemText from '../system-text/container'
import SystemUsersAddedToConv from '../system-users-added-to-conv/container'
import SetDescription from '../set-description/container'
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
import {dismiss as dismissKeyboard} from '../../../../util/keyboard'
import {formatTimeForChat} from '../../../../util/timestamp'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * row, and exploding meta tag.
 */

export type Props = {
  authorIsAdmin?: boolean
  authorIsOwner?: boolean
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
  onSwipeLeft: () => void
  orangeLineAbove: boolean
  previous?: Types.Message
  shouldShowPopup: boolean
  showCrowns: boolean
  showSendIndicator: boolean
}

type State = {
  disableCenteredHighlight: boolean
  showingPicker: boolean
  showMenuButton: boolean
}

class _WrapperMessage extends React.Component<Props & Kb.OverlayParentProps, State> {
  _mounted = false
  state = {
    disableCenteredHighlight: false,
    showMenuButton: false,
    showingPicker: false,
  }

  componentDidMount() {
    this._mounted = true
    this._updateHighlightMode()
  }

  componentWillUnmount() {
    this._mounted = false
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      this._updateHighlightMode()
    }
    if (this.props.measure) {
      const changed =
        this.props.orangeLineAbove !== prevProps.orangeLineAbove || this.props.message !== prevProps.message

      if (changed) {
        this.props.measure()
      }
    }
  }
  _updateHighlightMode = () => {
    switch (this.props.centeredOrdinal) {
      case 'flash':
        this.setState({disableCenteredHighlight: false})
        setTimeout(() => {
          if (this._mounted) {
            this.setState({disableCenteredHighlight: true})
          }
        }, 2000)
        break
      case 'always':
        this.setState({disableCenteredHighlight: false})
        break
    }
  }
  _showCenteredHighlight = () => {
    return !this.state.disableCenteredHighlight && this.props.centeredOrdinal !== 'none'
  }
  _onMouseOver = () => this.setState(o => (o.showMenuButton ? null : {showMenuButton: true}))
  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  _dismissKeyboard = () => dismissKeyboard()
  _orangeLine = () =>
    this.props.orangeLineAbove && <Kb.Box2 key="orangeLine" direction="vertical" style={styles.orangeLine} />
  _onAuthorClick = () => this.props.onAuthorClick()
  _isExploding = () =>
    (this.props.message.type === 'text' || this.props.message.type === 'attachment') &&
    this.props.message.exploding

  _authorAndContent = children => {
    let result
    if (this.props.showUsername) {
      result = (
        <React.Fragment key="authorAndContent">
          <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
            <Kb.Avatar
              size={32}
              username={this.props.showUsername}
              skipBackground={true}
              onClick={this._onAuthorClick}
              style={styles.avatar}
            />
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.usernameCrown}>
              <Kb.ConnectedUsernames
                colorBroken={true}
                colorFollowing={true}
                colorYou={true}
                type="BodySmallBold"
                usernames={[this.props.showUsername]}
                onUsernameClicked={this._onAuthorClick}
              />
              {this.props.showCrowns && (this.props.authorIsOwner || this.props.authorIsAdmin) && (
                <Kb.WithTooltip text={this.props.authorIsOwner ? 'Owner' : 'Admin'}>
                  <Kb.Icon
                    color={
                      this.props.authorIsOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35
                    }
                    fontSize={10}
                    type="iconfont-crown-owner"
                  />
                </Kb.WithTooltip>
              )}
              <Kb.Text type="BodyTiny" style={styles.timestamp}>
                {formatTimeForChat(this.props.message.timestamp)}
              </Kb.Text>
            </Kb.Box2>
          </Kb.Box2>
          <Kb.Box2
            key="content"
            direction="vertical"
            fullWidth={true}
            style={styles.contentUnderAuthorContainer}
          >
            {children}
          </Kb.Box2>
        </React.Fragment>
      )
    } else {
      result = children
    }
    return this.props.isPendingPayment ? (
      <PendingPaymentBackground key="pendingBackground">{result}</PendingPaymentBackground>
    ) : (
      result
    )
  }

  _isEdited = () =>
    // @ts-ignore
    this.props.message.hasBeenEdited && (
      <Kb.Text key="isEdited" type="BodyTiny" style={styles.edited}>
        EDITED
      </Kb.Text>
    )

  _isFailed = () =>
    !!this.props.failureDescription && (
      <Kb.Text key="isFailed" type="BodySmall">
        <Kb.Text type="BodySmall" style={styles.fail}>
          {this.props.failureDescription}.{' '}
        </Kb.Text>
        {!!this.props.onCancel && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={this.props.onCancel}>
            Cancel
          </Kb.Text>
        )}
        {!!this.props.onCancel && (!!this.props.onEdit || !!this.props.onRetry) && (
          <Kb.Text type="BodySmall"> or </Kb.Text>
        )}
        {!!this.props.onEdit && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={this.props.onEdit}>
            Edit
          </Kb.Text>
        )}
        {!!this.props.onRetry && (
          <Kb.Text type="BodySmall" style={styles.failUnderline} onClick={this.props.onRetry}>
            Retry
          </Kb.Text>
        )}
      </Kb.Text>
    )

  _unfurlPrompts = () =>
    this.props.hasUnfurlPrompts && (
      <UnfurlPromptList
        key="UnfurlPromptList"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  _unfurlList = () =>
    // @ts-ignore
    this.props.message.unfurls &&
    // @ts-ignore
    !this.props.message.unfurls.isEmpty() && (
      <UnfurlList
        key="UnfurlList"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  _coinFlip = () => {
    const message = this.props.message
    return (
      message.type === 'text' &&
      !!message.flipGameID && (
        <CoinFlip
          key="CoinFlip"
          conversationIDKey={this.props.conversationIDKey}
          flipGameID={message.flipGameID}
          isSendError={!!message.errorReason}
          text={message.text}
        />
      )
    )
  }

  _shouldShowReactionsRow = () =>
    // @ts-ignore
    (this.props.message.reactions && !this.props.message.reactions.isEmpty()) || this.props.isPendingPayment

  _reactionsRow = () =>
    this._shouldShowReactionsRow() && (
      <ReactionsRow
        key="ReactionsRow"
        btnClassName="WrapperMessage-emojiButton"
        newBtnClassName="WrapperMessage-newEmojiButton"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  _popup = () =>
    (this.props.message.type === 'text' ||
      this.props.message.type === 'attachment' ||
      this.props.message.type === 'sendPayment' ||
      this.props.message.type === 'requestPayment' ||
      this.props.message.type === 'setChannelname' ||
      this.props.message.type === 'setDescription' ||
      this.props.message.type === 'systemAddedToTeam' ||
      this.props.message.type === 'systemChangeRetention' ||
      this.props.message.type === 'systemGitPush' ||
      this.props.message.type === 'systemInviteAccepted' ||
      this.props.message.type === 'systemSimpleToComplex' ||
      this.props.message.type === 'systemText' ||
      this.props.message.type === 'systemUsersAddedToConversation') &&
    this.props.shouldShowPopup &&
    this.props.showingMenu && (
      <MessagePopup
        key="popup"
        attachTo={this.props.getAttachmentRef}
        message={this.props.message}
        onHidden={this.props.toggleShowingMenu}
        position="top right"
        style={styles.messagePopupContainer}
        visible={this.props.showingMenu}
      />
    )

  _containerProps = () => {
    if (Styles.isMobile) {
      const props = {
        style: Styles.collapseStyles([
          styles.container,
          !this.props.showUsername && styles.containerNoUsername,
          !this._isExploding() && styles.containerNoExploding, // extra right padding to line up with infopane / input icons
          this.props.isJoinLeave && styles.containerJoinLeave,
          this._showCenteredHighlight() && styles.centeredOrdinal,
        ]),
      }
      return this.props.decorate
        ? {
            ...props,
            onLongPress: this.props.toggleShowingMenu,
            onPress: this._dismissKeyboard,
            onSwipeLeft: this.props.onSwipeLeft,
            underlayColor: Styles.globalColors.blueLighter3,
          }
        : props
    } else {
      return {
        className: Styles.classNames(
          {
            'WrapperMessage-author': this.props.showUsername,
            'WrapperMessage-centered': this._showCenteredHighlight(),
            'WrapperMessage-decorated': this.props.decorate,
            'WrapperMessage-hoverColor': !this.props.isPendingPayment,
            'WrapperMessage-noOverflow': this.props.isPendingPayment,
            'WrapperMessage-systemMessage': this.props.message.type.startsWith('system'),
            active: this.props.showingMenu || this.state.showingPicker,
          },
          'WrapperMessage-hoverBox'
        ),
        onContextMenu: this.props.toggleShowingMenu,
        onMouseOver: this._onMouseOver,
        // attach popups to the message itself
        ref: this.props.setAttachmentRef,
        style: Styles.collapseStyles([this.props.isJoinLeave && styles.containerJoinLeave]),
      }
    }
  }

  _sendIndicator = () => {
    if (!this.props.showSendIndicator) {
      return null
    }
    const message = this.props.message
    const sent =
      (message.type !== 'text' && message.type !== 'attachment') || !message.submitState || message.exploded
    const failed =
      (message.type === 'text' || message.type === 'attachment') && message.submitState === 'failed'
    return (
      <SendIndicator
        key="sendIndicator"
        sent={sent}
        failed={failed}
        id={this.props.message.timestamp}
        style={styles.send}
      />
    )
  }

  _cachedMenuStyles = {}
  _menuAreaStyle = (exploded, exploding) => {
    const iconSizes = [
      this.props.isRevoked ? 16 : 0, // revoked
      this.props.showCoinsIcon ? 16 : 0, // coin stack
      exploded || Styles.isMobile ? 0 : 16, // ... menu
      exploding ? (Styles.isMobile ? 57 : 46) : 0, // exploding
    ].filter(Boolean)
    const padding = Styles.globalMargins.tiny
    const width =
      iconSizes.length <= 0 ? 0 : iconSizes.reduce((total, size) => total + size, iconSizes.length * padding)

    const key = `${width}:${this.props.showUsername ? 1 : 0}:${exploding ? 1 : 0}:${exploded ? 1 : 0}`

    if (!this._cachedMenuStyles[key]) {
      this._cachedMenuStyles[key] = Styles.collapseStyles([
        styles.menuButtons,
        !exploded && {width},
        !!this.props.showUsername && styles.menuButtonsWithAuthor,
      ])
    }
    return this._cachedMenuStyles[key]
  }

  _messageAndButtons = () => {
    const showMenuButton = !Styles.isMobile && this.state.showMenuButton
    const message = this.props.message
    let child: React.ReactNode = null
    let exploded = false
    let explodedBy = ''
    switch (message.type) {
      case 'text':
        exploded = message.exploded
        explodedBy = message.explodedBy
        child = <TextMessage key="text" message={message} />
        break
      case 'attachment':
        exploded = message.exploded
        explodedBy = message.explodedBy
        child = (
          <AttachmentMessage
            key="attachment"
            message={message}
            toggleMessageMenu={this.props.toggleShowingMenu}
          />
        )
        break
      case 'requestPayment':
        child = <PaymentMessage key="requestPayment" message={message} />
        break
      case 'sendPayment':
        child = <PaymentMessage key="sendPayment" message={message} />
        break
      case 'placeholder':
        child = <MessagePlaceholder key="placeholder" message={message} />
        break
      case 'systemInviteAccepted':
        child = <SystemInviteAccepted key="systemInviteAccepted" message={message} />
        break
      case 'systemSimpleToComplex':
        child = <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
        break
      case 'systemGitPush':
        child = <SystemGitPush key="systemGitPush" message={message} />
        break
      case 'systemAddedToTeam':
        child = <SystemAddedToTeam key="systemAddedToTeam" message={message} />
        break
      case 'systemChangeRetention':
        child = <SystemChangeRetention key="systemChangeRetention" message={message} />
        break
      case 'systemUsersAddedToConversation':
        child = <SystemUsersAddedToConv key="systemUsersAddedToConv" message={message} />
        break
      case 'systemJoined':
        child = <SystemJoined key="systemJoined" message={message} />
        break
      case 'systemText':
        child = <SystemText key="systemText" message={message} />
        break
      case 'systemLeft':
        child = <SystemLeft key="systemLeft" message={message} />
        break
      case 'setDescription':
        child = <SetDescription key="setDescription" message={message} />
        break
      case 'setChannelname':
        child = <SetChannelname key="setChannelname" message={message} />
        break
      case 'deleted':
        return null
      default:
        return null
    }

    const exploding = this._isExploding()
    const maybeExplodedChild = exploding ? (
      <ExplodingHeightRetainer
        explodedBy={explodedBy}
        exploding={exploding}
        measure={this.props.measure}
        messageKey={Constants.getMessageKey(message)}
        retainHeight={this.props.forceAsh || exploded}
      >
        {child}
      </ExplodingHeightRetainer>
    ) : (
      child
    )

    // We defer mounting the menu buttons since they are expensive and only show up on hover on desktop and not at all on mobile
    // but this creates complexity as we can't use box2 gap stuff since we can either
    // 1. Haven't mounted it yet
    // 2. Have mounted but its hidden w/ css
    // TODO cleaner way to do this, or speedup react button maybe
    if (this.props.decorate && !exploded) {
      return (
        <Kb.Box2 key="messageAndButtons" direction="horizontal" fullWidth={true}>
          {maybeExplodedChild}
          <Kb.Box2 direction="horizontal" style={this._menuAreaStyle(exploded, exploding)}>
            {exploding && (
              <ExplodingMeta
                conversationIDKey={this.props.conversationIDKey}
                onClick={this.props.toggleShowingMenu}
                ordinal={message.ordinal}
              />
            )}
            {this.props.isRevoked && (
              <Kb.Icon
                type="iconfont-exclamation"
                color={Styles.globalColors.blue}
                fontSize={14}
                style={styles.marginLeftTiny}
              />
            )}
            {this.props.showCoinsIcon && (
              <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.marginLeftTiny} />
            )}
            {showMenuButton ? (
              <Kb.Box className="WrapperMessage-buttons">
                {!this._shouldShowReactionsRow() &&
                  Constants.isDecoratedMessage(this.props.message) &&
                  !this.props.showingMenu && (
                    <EmojiRow
                      className={Styles.classNames({
                        'WrapperMessage-emojiRow': !this.props.isLastInThread,
                      })}
                      conversationIDKey={this.props.conversationIDKey}
                      onShowingEmojiPicker={this._setShowingPicker}
                      ordinal={message.ordinal}
                      style={Styles.collapseStyles([
                        styles.emojiRow,
                        this.props.isLastInThread && styles.emojiRowLast,
                      ])}
                    />
                  )}
                <Kb.Box>
                  {this.props.shouldShowPopup && (
                    <Kb.Icon
                      type="iconfont-ellipsis"
                      onClick={this.props.toggleShowingMenu}
                      style={styles.ellipsis}
                      fontSize={14}
                    />
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
          <Kb.Box2 direction="horizontal" style={this._menuAreaStyle(exploded, exploding)}>
            <ExplodingMeta
              conversationIDKey={this.props.conversationIDKey}
              onClick={this.props.toggleShowingMenu}
              ordinal={message.ordinal}
            />
          </Kb.Box2>
        </Kb.Box2>
      )
    } else {
      return maybeExplodedChild
    }
  }

  render() {
    if (!this.props.message) {
      return null
    }
    return (
      <>
        <LongPressable
          {...this._containerProps()}
          children={[
            this._authorAndContent([
              this._messageAndButtons(),
              this._isEdited(),
              this._isFailed(),
              this._unfurlPrompts(),
              this._unfurlList(),
              this._coinFlip(),
              this._reactionsRow(),
            ]),
            this._sendIndicator(),
            this._orangeLine(),
          ]}
        />
        {this._popup()}
      </>
    )
  }
}

const WrapperMessage = Kb.OverlayParentHOC(_WrapperMessage)

const fast = {backgroundColor: Styles.globalColors.fastBlank}
const styles = Styles.styleSheetCreate({
  authorContainer: Styles.platformStyles({
    common: {
      alignItems: 'flex-start',
      alignSelf: 'flex-start',
      height: Styles.globalMargins.mediumLarge,
    },
    isMobile: {marginTop: 8},
  }),
  avatar: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.small,
    },
    isMobile: {marginLeft: Styles.globalMargins.tiny},
  }),
  centeredOrdinal: {
    backgroundColor: Styles.globalColors.yellow,
  },
  container: Styles.platformStyles({isMobile: {overflow: 'hidden'}}),
  containerJoinLeave: Styles.platformStyles({
    isMobile: {
      paddingLeft: Styles.globalMargins.tiny,
    },
  }),
  containerNoExploding: Styles.platformStyles({isMobile: {paddingRight: Styles.globalMargins.tiny}}),
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
  ellipsis: {marginLeft: Styles.globalMargins.tiny},
  emojiRow: Styles.platformStyles({
    isElectron: {
      borderBottom: `1px solid ${Styles.globalColors.black_10}`,
      borderBottomLeftRadius: Styles.borderRadius,
      borderBottomRightRadius: Styles.borderRadius,
      borderLeft: `1px solid ${Styles.globalColors.black_10}`,
      borderRight: `1px solid ${Styles.globalColors.black_10}`,
      bottom: -Styles.globalMargins.mediumLarge,
      height: Styles.globalMargins.mediumLarge,
      paddingBottom: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.xtiny,
      position: 'absolute',
      right: 96,
      zIndex: 2,
    },
  }),
  emojiRowLast: Styles.platformStyles({
    isElectron: {
      border: 'none',
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
      borderTopLeftRadius: Styles.borderRadius,
      borderTopRightRadius: Styles.borderRadius,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingTop: Styles.globalMargins.tiny,
      top: -Styles.globalMargins.mediumLarge + 1, // compensation for the orange line
    },
  }),
  fail: {color: Styles.globalColors.redDark},
  failUnderline: {color: Styles.globalColors.redDark, textDecorationLine: 'underline'},
  fast,
  marginLeftTiny: {marginLeft: Styles.globalMargins.tiny},
  menuButtons: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
    isElectron: {height: 16},
    isMobile: {height: 21},
  }),
  menuButtonsWithAuthor: {marginTop: -16},
  messagePopupContainer: {
    marginRight: Styles.globalMargins.small,
  },
  orangeLine: {
    // don't push down content due to orange line
    backgroundColor: Styles.globalColors.orange,
    flexShrink: 0,
    height: 1,
    left: 0,
    position: 'absolute',
    right: 0,
    top: Styles.isMobile ? 1 : 0, // mobile needs some breathing room for some reason
  },
  send: Styles.platformStyles({
    common: {position: 'absolute'},
    isElectron: {
      pointerEvents: 'none',
      right: 12,
    },
    isMobile: {right: 0},
  }),
  timestamp: Styles.platformStyles({
    common: {paddingLeft: Styles.globalMargins.xtiny},
    isElectron: {lineHeight: 19},
  }),
  usernameCrown: Styles.platformStyles({
    isElectron: {
      alignItems: 'baseline',
      position: 'relative',
      top: -2,
    },
    isMobile: {alignItems: 'center'},
  }),
})

export default WrapperMessage
