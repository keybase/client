// @flow
import * as Kb from '../../../../common-adapters'
import * as React from 'react'
import * as Styles from '../../../../styles'
import * as Types from '../../../../constants/types/chat2'
import * as Constants from '../../../../constants/chat2'
import SystemAddedToTeam from '../system-added-to-team/container'
import SystemGitPush from '../system-git-push/container'
import SystemInviteAccepted from '../system-invite-accepted/container'
import SystemJoined from '../system-joined/container'
import SystemLeft from '../system-left/container'
import SystemSimpleToComplex from '../system-simple-to-complex/container'
import SystemText from '../system-text/container'
import SetDescription from '../set-description/container'
import SetChannelname from '../set-channelname/container'
import TextMessage from '../text/container'
import AttachmentMessage from '../attachment/container'
import PaymentMessage from '../account-payment/container'
import Placeholder from '../placeholder/container'
import ExplodingHeightRetainer from './exploding-height-retainer'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import MessagePopup from '../message-popup'
import ReactButton from '../react-button/container'
import ReactionsRow from '../reactions-row/container'
import SendIndicator from './send-indicator'
import UnfurlList from './unfurl/unfurl-list/container'
import UnfurlPromptList from './unfurl/prompt-list/container'
import {dismiss as dismissKeyboard} from '../../../../util/keyboard'
import {formatTimeForChat} from '../../../../util/timestamp'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * button, and exploding meta tag.
 */

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  decorate: boolean,
  exploded: boolean,
  failureDescription: string,
  hasUnfurlPrompts: boolean,
  isRevoked: boolean,
  showUsername: string,
  measure: ?() => void,
  message: Types.Message,
  onAuthorClick: () => void,
  onCancel: ?() => void,
  onEdit: ?() => void,
  onRetry: ?() => void,
  orangeLineAbove: boolean,
  previous: ?Types.Message,
  shouldShowPopup: boolean,
  showSendIndicator: boolean,
|}

type State = {
  showingPicker: boolean,
  showMenuButton: boolean,
}
class _WrapperMessage extends React.Component<Props & Kb.OverlayParentProps, State> {
  state = {showMenuButton: false, showingPicker: false}

  componentDidUpdate(prevProps: Props) {
    if (this.props.measure) {
      const changed =
        this.props.orangeLineAbove !== prevProps.orangeLineAbove || this.props.message !== prevProps.message

      if (changed) {
        this.props.measure()
      }
    }
  }
  _onMouseOver = () => this.setState(o => (o.showMenuButton ? null : {showMenuButton: true}))
  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  _dismissKeyboard = () => dismissKeyboard()
  _orangeLine = () => this.props.orangeLineAbove && <Kb.Box2 direction="vertical" style={styles.orangeLine} />
  _onAuthorClick = () => this.props.onAuthorClick()

  _authorAndContent = children => {
    if (this.props.showUsername) {
      return (
        <React.Fragment key="authorAndContent">
          <Kb.Box2 key="author" direction="horizontal" style={styles.authorContainer} gap="tiny">
            <Kb.Avatar
              size={32}
              username={this.props.showUsername}
              skipBackground={true}
              onClick={this._onAuthorClick}
              style={styles.avatar}
            />
            <Kb.ConnectedUsernames
              colorBroken={true}
              colorFollowing={true}
              colorYou={true}
              type="BodySmallSemibold"
              usernames={[this.props.showUsername]}
              onUsernameClicked={this._onAuthorClick}
            />
            <Kb.Text type="BodyTiny">{formatTimeForChat(this.props.message.timestamp)}</Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            key="content"
            direction="vertical"
            fullWidth={true}
            style={styles.contentUnderAuthorContainer}
            gap="tiny"
          >
            {children}
          </Kb.Box2>
        </React.Fragment>
      )
    } else {
      return children
    }
  }

  _isEdited = () =>
    // $ForceType
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
    // $ForceType
    this.props.message.unfurls &&
    !this.props.message.unfurls.isEmpty() && (
      <UnfurlList
        key="UnfurlList"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  _reactionsRow = () =>
    // $ForceType
    this.props.message.reactions &&
    !this.props.message.reactions.isEmpty() && (
      <ReactionsRow
        key="ReactionsRow"
        conversationIDKey={this.props.conversationIDKey}
        ordinal={this.props.message.ordinal}
      />
    )

  _popup = () =>
    (this.props.message.type === 'text' ||
      this.props.message.type === 'attachment' ||
      this.props.message.type === 'sendPayment' ||
      this.props.message.type === 'requestPayment') &&
    this.props.shouldShowPopup &&
    this.props.showingMenu && (
      <MessagePopup
        key="popup"
        attachTo={this.props.getAttachmentRef}
        message={this.props.message}
        onHidden={this.props.toggleShowingMenu}
        position="top center"
        visible={this.props.showingMenu}
      />
    )

  _containerProps = () => {
    if (Styles.isMobile) {
      const props = this.props.showUsername ? {} : {style: styles.containerNoUsername}
      return this.props.decorate
        ? {
            ...props,
            onLongPress: this.props.toggleShowingMenu,
            onPress: this._dismissKeyboard,
            underlayColor: Styles.globalColors.blue5,
          }
        : props
    } else {
      return {
        className: Styles.classNames('WrapperMessage-hoverBox', {
          'WrapperMessage-author': this.props.showUsername,
          'WrapperMessage-decorated': this.props.decorate,
          active: this.props.showingMenu || this.state.showingPicker,
        }),
        onMouseOver: this._onMouseOver,
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
  _menuAreaStyle = () => {
    // $ForceType
    const exploding = this.props.message.exploding
    const iconSizes = [
      this.props.isRevoked ? 16 : 0, // revoked
      Styles.isMobile ? 0 : 16, // reactji
      Styles.isMobile ? 0 : 16, // ... menu
      exploding ? 46 : 0, // exploding
    ].filter(Boolean)
    const padding = 8
    const width =
      iconSizes.length <= 0 ? 0 : iconSizes.reduce((total, size) => total + size, iconSizes.length * padding)

    const key = `${width}:${this.props.showUsername ? 1 : 0}`

    if (!this._cachedMenuStyles[key]) {
      this._cachedMenuStyles[key] = Styles.collapseStyles([
        styles.menuButtons,
        {width},
        !!this.props.showUsername && styles.menuButtonsWithAuthor,
      ])
    }
    return this._cachedMenuStyles[key]
  }

  _messageAndButtons = () => {
    const showMenuButton = !Styles.isMobile && this.state.showMenuButton
    const message = this.props.message
    let child
    let exploding = false
    let exploded = false
    let explodedBy = null
    switch (message.type) {
      case 'text':
        exploding = message.exploding
        exploded = message.exploded
        explodedBy = message.explodedBy
        child = <TextMessage key="text" message={message} />
        break
      case 'attachment':
        exploding = message.exploding
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
        child = <Placeholder key="placeholder" message={message} />
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
        /*::
      declare var ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove: (a: empty) => any
      ifFlowErrorsHereItsCauseYouDidntHandleAllTypesAbove(message.type);
      */
        return null
    }
    const retainHeight =
      this.props.failureDescription === 'This exploding message is not available to you' || exploded

    const maybeExplodedChild = exploding ? (
      <ExplodingHeightRetainer
        explodedBy={explodedBy}
        exploding={exploding}
        measure={this.props.measure}
        messageKey={Constants.getMessageKey(message)}
        retainHeight={retainHeight}
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
          <Kb.Box2 direction="horizontal" style={this._menuAreaStyle()}>
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
                style={styles.revoked}
              />
            )}
            {showMenuButton ? (
              <Kb.Box className="WrapperMessage-buttons">
                <ReactButton
                  conversationIDKey={this.props.conversationIDKey}
                  ordinal={message.ordinal}
                  onShowPicker={this._setShowingPicker}
                  showBorder={false}
                  style={styles.reactButton}
                />
                <Kb.Box ref={this.props.setAttachmentRef}>
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
        {LongPressable({
          ...this._containerProps(),
          children: [
            this._orangeLine(),
            this._authorAndContent([
              this._messageAndButtons(),
              this._isEdited(),
              this._isFailed(),
              this._sendIndicator(),
              this._unfurlPrompts(),
              this._unfurlList(),
              this._reactionsRow(),
            ]),
          ],
        })}
        {this._popup()}
      </>
    )
  }
}

const WrapperMessage = Kb.OverlayParentHOC(_WrapperMessage)

const styles = Styles.styleSheetCreate({
  authorContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  avatar: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.small,
      marginTop: -Styles.globalMargins.tiny,
    },
    isMobile: {
      marginLeft: Styles.globalMargins.tiny,
    },
  }),
  containerNoUsername: Styles.platformStyles({
    isMobile: {
      paddingBottom: 2,
      paddingLeft:
        // Space for below the avatar
        Styles.globalMargins.tiny + // right margin
        Styles.globalMargins.tiny + // left margin
        Styles.globalMargins.mediumLarge, // avatar
      paddingRight: Styles.globalMargins.tiny,
    },
  }),
  contentUnderAuthorContainer: Styles.platformStyles({
    isElectron: {
      marginTop: -Styles.globalMargins.tiny,
      paddingLeft:
        // Space for below the avatar
        Styles.globalMargins.tiny + // right margin
        Styles.globalMargins.small + // left margin
        Styles.globalMargins.mediumLarge, // avatar
    },
    isMobile: {
      marginTop: -12,
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
  fail: {color: Styles.globalColors.red},
  failUnderline: {color: Styles.globalColors.red, textDecorationLine: 'underline'},
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
  orangeLine: {backgroundColor: Styles.globalColors.orange, height: 1, width: '100%'},
  reactButton: Styles.platformStyles({
    isElectron: {width: 16},
  }),
  revoked: {marginLeft: Styles.globalMargins.tiny},
  send: Styles.platformStyles({
    isElectron: {
      pointerEvents: 'none',
      position: 'absolute',
      right: 0,
    },
  }),
})

export default WrapperMessage
