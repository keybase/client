import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
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
import SystemNewChannel from '../system-new-channel'
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
import {dismiss as dismissKeyboard} from '../../../../util/keyboard'
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
}

type State = {
  disableCenteredHighlight: boolean
  showingPicker: boolean
  showMenuButton: boolean
}

class _WrapperMessage extends React.Component<Props & Kb.OverlayParentProps, State> {
  private mounted = false
  state = {
    disableCenteredHighlight: false,
    showMenuButton: false,
    showingPicker: false,
  }

  componentDidMount() {
    this.mounted = true
    this.updateHighlightMode()
  }

  componentWillUnmount() {
    this.mounted = false
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.centeredOrdinal !== prevProps.centeredOrdinal) {
      this.updateHighlightMode()
    }
    if (this.props.measure) {
      const changed =
        this.props.orangeLineAbove !== prevProps.orangeLineAbove || this.props.message !== prevProps.message

      if (changed) {
        this.props.measure()
      }
    }
  }
  private updateHighlightMode = () => {
    switch (this.props.centeredOrdinal) {
      case 'flash':
        this.setState({disableCenteredHighlight: false})
        setTimeout(() => {
          if (this.mounted) {
            this.setState({disableCenteredHighlight: true})
          }
        }, 2000)
        break
      case 'always':
        this.setState({disableCenteredHighlight: false})
        break
    }
  }
  private showCenteredHighlight = () =>
    !this.state.disableCenteredHighlight && this.props.centeredOrdinal !== 'none'
  private onMouseOver = () => this.setState(o => (o.showMenuButton ? null : {showMenuButton: true}))
  private setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  private dismissKeyboard = () => dismissKeyboard()
  private orangeLine = () =>
    this.props.orangeLineAbove && (
      <Kb.Box2
        key="orangeLine"
        direction="vertical"
        style={Styles.collapseStyles([
          styles.orangeLine,
          !this.props.showUsername && styles.orangeLineCompensationLeft,
        ])}
      />
    )
  private onAuthorClick = () => this.props.onAuthorClick()
  private isExploding = () =>
    (this.props.message.type === 'text' || this.props.message.type === 'attachment') &&
    this.props.message.exploding

  private authorAndContent = (children: React.ReactNode) => {
    let result
    const username = (
      <Kb.ConnectedUsernames
        colorBroken={true}
        colorFollowing={true}
        colorYou={true}
        onUsernameClicked={this.onAuthorClick}
        style={Styles.collapseStyles([
          this.showCenteredHighlight() && this.props.youAreAuthor && styles.usernameHighlighted,
        ])}
        type="BodySmallBold"
        usernames={this.props.showUsername}
      />
    )
    if (this.props.showUsername) {
      result = (
        <React.Fragment key="authorAndContent">
          <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
            <Kb.Avatar
              size={32}
              username={this.props.showUsername}
              skipBackground={true}
              onClick={this.onAuthorClick}
              style={styles.avatar}
            />
            <Kb.Box2 direction="horizontal" gap="xtiny" fullWidth={true} style={styles.usernameCrown}>
              {this.props.botAlias ? (
                <Kb.Box2 direction="horizontal">
                  <Kb.Text type="BodySmallBold" style={styles.botAlias} lineClamp={1}>
                    {this.props.botAlias}
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
              )}
              {this.props.showCrowns && (this.props.authorIsOwner || this.props.authorIsAdmin) && (
                <Kb.WithTooltip tooltip={this.props.authorIsOwner ? 'Owner' : 'Admin'}>
                  <Kb.Icon
                    color={
                      this.props.authorIsOwner ? Styles.globalColors.yellowDark : Styles.globalColors.black_35
                    }
                    fontSize={10}
                    type="iconfont-crown-owner"
                  />
                </Kb.WithTooltip>
              )}
              {this.props.authorIsBot && (
                <Kb.WithTooltip tooltip="Bot">
                  <Kb.Icon fontSize={10} color={Styles.globalColors.black_35} type="iconfont-bot" />
                </Kb.WithTooltip>
              )}
              <Kb.Text
                type="BodyTiny"
                style={Styles.collapseStyles([
                  styles.timestamp,
                  this.showCenteredHighlight() && styles.timestampHighlighted,
                ])}
              >
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

  private isEdited = () =>
    this.props.message.hasBeenEdited && (
      <Kb.Text
        key="isEdited"
        type="BodyTiny"
        style={Styles.collapseStyles([
          styles.edited,
          this.showCenteredHighlight() && styles.editedHighlighted,
        ])}
      >
        EDITED
      </Kb.Text>
    )

  private isFailed = () =>
    // hide error messages if the exploding message already exploded
    !!this.props.failureDescription &&
    !(this.isExploding() && this.props.exploded) && (
      <Kb.Text key="isFailed" type="BodySmall">
        <Kb.Text type="BodySmall" style={this.isExploding() ? styles.failExploding : styles.fail}>
          {this.isExploding() && (
            <>
              <Kb.Icon fontSize={16} boxStyle={styles.failExplodingIcon} type="iconfont-block" />{' '}
            </>
          )}
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

  private unfurlPrompts = () =>
    this.props.hasUnfurlPrompts && (
      <UnfurlPromptList
        key="UnfurlPromptList"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  private unfurlList = () =>
    this.props.message.type === 'text' &&
    this.props.message.unfurls &&
    !!this.props.message.unfurls.size && (
      <UnfurlList
        key="UnfurlList"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
        toggleMessagePopup={this.props.toggleShowingMenu}
      />
    )

  private coinFlip = () => {
    const message = this.props.message
    return (
      message.type === 'text' &&
      !!message.flipGameID && (
        <CoinFlip
          key="CoinFlip"
          conversationIDKey={this.props.conversationIDKey}
          flipGameID={message.flipGameID}
          measure={this.props.measure}
          isSendError={!!message.errorReason}
          text={message.text}
        />
      )
    )
  }

  private hasReactions = () =>
    (!!this.props.message.reactions && !!this.props.message.reactions.size) || this.props.isPendingPayment

  private reactionsRow = () =>
    this.hasReactions() && (
      <ReactionsRow
        key="ReactionsRow"
        btnClassName="WrapperMessage-emojiButton"
        newBtnClassName="WrapperMessage-newEmojiButton"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  private getKeyedBot = () => this.props.message.type === 'text' && this.props.message.botUsername

  private popup = () =>
    (this.props.message.type === 'text' ||
      this.props.message.type === 'attachment' ||
      this.props.message.type === 'sendPayment' ||
      this.props.message.type === 'requestPayment' ||
      this.props.message.type === 'setChannelname' ||
      this.props.message.type === 'setDescription' ||
      this.props.message.type === 'pin' ||
      this.props.message.type === 'systemAddedToTeam' ||
      this.props.message.type === 'systemChangeRetention' ||
      this.props.message.type === 'systemGitPush' ||
      this.props.message.type === 'systemInviteAccepted' ||
      this.props.message.type === 'systemSimpleToComplex' ||
      this.props.message.type === 'systemSBSResolved' ||
      this.props.message.type === 'systemText' ||
      this.props.message.type === 'systemUsersAddedToConversation' ||
      this.props.message.type === 'journeycard') &&
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

  private containerProps = () => {
    if (Styles.isMobile) {
      const props = {
        style: Styles.collapseStyles([
          styles.container,
          this.showCenteredHighlight() && styles.centeredOrdinal,
          !this.props.showUsername && styles.containerNoUsername,
        ]),
      }
      return this.props.decorate
        ? {
            ...props,
            onLongPress: this.props.toggleShowingMenu,
            onPress: this.dismissKeyboard,
            onSwipeLeft: this.props.onSwipeLeft,
            underlayColor: Styles.globalColors.blueLighter3,
          }
        : props
    } else {
      return {
        className: Styles.classNames(
          {
            'WrapperMessage-author': this.props.showUsername,
            'WrapperMessage-centered': this.showCenteredHighlight(),
            'WrapperMessage-decorated': this.props.decorate,
            'WrapperMessage-hoverColor': !this.props.isPendingPayment,
            'WrapperMessage-noOverflow': this.props.isPendingPayment,
            'WrapperMessage-systemMessage': this.props.message.type.startsWith('system'),
            active: this.props.showingMenu || this.state.showingPicker,
          },
          'WrapperMessage-hoverBox'
        ),
        onContextMenu: this.props.toggleShowingMenu,
        onMouseOver: this.onMouseOver,
        // attach popups to the message itself
        ref: this.props.setAttachmentRef,
      }
    }
  }

  private sendIndicator = () => {
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

  private cachedMenuStyles = new Map<string, Styles.StylesCrossPlatform>()
  private menuAreaStyle = (exploded: boolean, exploding: boolean) => {
    const iconSizes = [
      this.props.isRevoked ? 24 : 0, // revoked
      this.props.showCoinsIcon ? 24 : 0, // coin stack
      exploded || Styles.isMobile ? 0 : 16, // ... menu
      exploding ? (Styles.isMobile ? 57 : 46) : 0, // exploding
      this.getKeyedBot() && !this.props.authorIsBot ? 24 : 0,
    ].filter(Boolean)
    const padding = Styles.globalMargins.tiny
    const width =
      iconSizes.length <= 0 ? 0 : iconSizes.reduce((total, size) => total + size, iconSizes.length * padding)

    const key = `${width}:${this.props.showUsername ? 1 : 0}:${exploding ? 1 : 0}:${exploded ? 1 : 0}`

    if (!this.cachedMenuStyles.has(key)) {
      this.cachedMenuStyles.set(
        key,
        Styles.collapseStyles([
          styles.menuButtons,
          !exploded && {width},
          !!this.props.showUsername && styles.menuButtonsWithAuthor,
        ])
      )
    }
    return this.cachedMenuStyles.get(key)
  }

  private messageAndButtons = () => {
    const showMenuButton = !Styles.isMobile && this.state.showMenuButton
    const message = this.props.message
    let child: React.ReactNode = null
    let exploded = false
    let explodedBy = ''
    switch (message.type) {
      case 'text':
        exploded = message.exploded
        explodedBy = message.explodedBy
        child = <TextMessage isHighlighted={this.showCenteredHighlight()} key="text" message={message} />
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
      case 'systemSBSResolved':
        if (this.props.youAreAuthor) {
          child = <SystemSBSResolved key="systemSbsResolved" message={message} />
        } else {
          child = (
            <SystemJoined
              key="systemJoined"
              message={{...message, joiners: [message.prover], leavers: [], type: 'systemJoined'}}
            />
          )
        }
        break
      case 'systemSimpleToComplex':
        child = <SystemSimpleToComplex key="systemSimpleToComplex" message={message} />
        break
      case 'systemGitPush':
        child = <SystemGitPush key="systemGitPush" message={message} />
        break
      case 'systemCreateTeam':
        child = <SystemCreateTeam key="systemCreateTeam" message={message} />
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
      case 'systemChangeAvatar':
        child = <SystemChangeAvatar key="systemChangeAvatar" message={message} />
        break
      case 'systemNewChannel':
        child = <SystemNewChannel key="systemNewChannel" message={message} />
        break
      case 'setDescription':
        child = <SetDescription key="setDescription" message={message} />
        break
      case 'pin':
        child = (
          <Pin key="pin" conversationIDKey={message.conversationIDKey} messageID={message.pinnedMessageID} />
        )
        break
      case 'setChannelname':
        child = <SetChannelname key="setChannelname" message={message} />
        break
      case 'deleted':
        return null
      default:
        return null
    }

    const exploding = this.isExploding()
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
          <Kb.Box2 direction="horizontal" style={this.menuAreaStyle(exploded, exploding)}>
            {exploding && (
              <ExplodingMeta
                conversationIDKey={this.props.conversationIDKey}
                isParentHighlighted={this.showCenteredHighlight()}
                onClick={this.props.toggleShowingMenu}
                ordinal={message.ordinal}
              />
            )}
            {this.props.isRevoked && (
              <Kb.Icon
                type="iconfont-rip"
                style={styles.paddingLeftTiny}
                color={Styles.globalColors.black_20}
              />
            )}
            {this.props.showCoinsIcon && (
              <Kb.Icon type="icon-stellar-coins-stacked-16" style={styles.paddingLeftTiny} />
            )}
            {this.getKeyedBot() && !this.props.authorIsBot && (
              <Kb.WithTooltip tooltip={`Encrypted for @${this.getKeyedBot()}`}>
                <Kb.Icon
                  color={Styles.globalColors.black_35}
                  type="iconfont-bot"
                  onClick={() => null}
                  sizeType="Small"
                  style={styles.paddingLeftTiny}
                />
              </Kb.WithTooltip>
            )}
            {showMenuButton ? (
              <Kb.Box className="WrapperMessage-buttons">
                {!this.hasReactions() &&
                  Constants.isMessageWithReactions(this.props.message) &&
                  !this.props.showingMenu && (
                    <EmojiRow
                      className={Styles.classNames({
                        'WrapperMessage-emojiRow': !this.props.isLastInThread,
                      })}
                      conversationIDKey={this.props.conversationIDKey}
                      onShowingEmojiPicker={this.setShowingPicker}
                      ordinal={message.ordinal}
                      tooltipPosition={this.props.isLastInThread ? 'top center' : 'bottom center'}
                      style={Styles.collapseStyles([
                        styles.emojiRow,
                        !Styles.isDarkMode && styles.emojiRowBorder,
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
          <Kb.Box2 direction="horizontal" style={this.menuAreaStyle(exploded, exploding)}>
            <ExplodingMeta
              conversationIDKey={this.props.conversationIDKey}
              isParentHighlighted={this.showCenteredHighlight()}
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
          {...this.containerProps()}
          children={[
            this.props.message.type === 'journeycard' ? (
              <TeamJourney key="journey" message={this.props.message} />
            ) : (
              this.authorAndContent([
                this.messageAndButtons(),
                this.isEdited(),
                this.isFailed(),
                this.unfurlPrompts(),
                this.unfurlList(),
                this.coinFlip(),
                this.reactionsRow(),
              ])
            ),
            this.orangeLine(),
            this.sendIndicator(),
          ]}
        />
        {this.popup()}
      </>
    )
  }
}

const WrapperMessage = Kb.OverlayParentHOC(_WrapperMessage)

const fast = {backgroundColor: Styles.globalColors.fastBlank}
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
        common: {
          color: Styles.globalColors.black,
        },
        isElectron: {
          maxWidth: 240,
          wordBreak: 'break-all',
        },
        isMobile: {
          maxWidth: 120,
        },
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
      ellipsis: {marginLeft: Styles.globalMargins.tiny},
      emojiRow: Styles.platformStyles({
        isElectron: {
          borderBottomLeftRadius: Styles.borderRadius,
          borderBottomRightRadius: Styles.borderRadius,
          bottom: -Styles.globalMargins.mediumLarge + 1,
          height: Styles.globalMargins.mediumLarge,
          paddingBottom: Styles.globalMargins.tiny,
          paddingRight: Styles.globalMargins.xtiny,
          paddingTop: Styles.globalMargins.xtiny,
          position: 'absolute',
          right: 96,
          zIndex: 2,
        },
      }),
      emojiRowBorder: Styles.platformStyles({
        isElectron: {
          borderBottom: `1px solid ${Styles.globalColors.black_10}`,
          borderLeft: `1px solid ${Styles.globalColors.black_10}`,
          borderRight: `1px solid ${Styles.globalColors.black_10}`,
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
      failExploding: {color: Styles.globalColors.black_50},
      failExplodingIcon: Styles.platformStyles({
        isElectron: {
          display: 'inline-block',
          verticalAlign: 'middle',
        },
      }),
      failUnderline: {color: Styles.globalColors.redDark, textDecorationLine: 'underline'},
      fast,
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
      messagePopupContainer: {marginRight: Styles.globalMargins.small},
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
        isMobile: {
          left: -Styles.globalMargins.mediumLarge, // compensate for containerNoUsername's padding
        },
      }),
      paddingLeftTiny: {paddingLeft: Styles.globalMargins.tiny},
      send: Styles.platformStyles({
        common: {position: 'absolute'},
        isElectron: {
          pointerEvents: 'none',
          right: 8,
          top: 2,
        },
        isMobile: {
          right: 0,
          top: -8,
        },
      }),
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
        isMobile: {
          alignItems: 'center',
        },
      }),
      usernameHighlighted: {color: Styles.globalColors.blackOrBlack},
    } as const)
)

export default WrapperMessage
