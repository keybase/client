// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import * as Kb from '../../../../common-adapters'
import {dismiss as dismissKeyboard} from '../../../../util/keyboard'
import * as Styles from '../../../../styles'
import ReactionsRow from '../reactions-row/container'
import UnfurlPromptList from '../unfurl/prompt-list/container'
import UnfurlList from '../unfurl/unfurl-list/container'
import ReactButton from '../react-button/container'
import MessagePopup from '../message-popup'
import ExplodingMeta from './exploding-meta/container'
import LongPressable from './long-pressable'
import {formatTimeForChat} from '../../../../util/timestamp'

/**
 * WrapperMessage adds the orange line, menu button, menu, reacji
 * button, and exploding meta tag.
 */

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  decorate: boolean,
  exploded: boolean,
  isRevoked: boolean,
  isShowingUsername: boolean,
  ordinal: Types.Ordinal,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
  children?: React.Node,
  isEditing: boolean,
  orangeLineAbove: boolean,
  shouldShowPopup: boolean,
  hasUnfurlPrompts: boolean,
|}

type State = {
  showingPicker: boolean,
  showMenuButton: boolean,
}
class _WrapperMessage extends React.Component<Props & Kb.OverlayParentProps, State> {
  state = {showMenuButton: false, showingPicker: false}
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure && this.props.orangeLineAbove !== prevProps.orangeLineAbove) {
      this.props.measure()
    }
  }
  _onMouseOver = Styles.isMobile
    ? () => {}
    : () => {
        this.setState(o => (o.showMenuButton ? null : {showMenuButton: true}))
      }
  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))

  _dismissKeyboard = () => dismissKeyboard()

  _orangeLine = () => this.props.orangeLineAbove && <Kb.Box2 direction="vertical" style={styles.orangeLine} />

  _content = children => {
    if (this.props.isShowingUsername) {
      return (
        <>
          <Kb.Box2 direction="horizontal" style={styles.authorContainer} gap="tiny">
            <Kb.Avatar
              size={32}
              username={this.props.message.author}
              skipBackground={true}
              onClick={this.props.onAuthorClick}
              style={styles.avatar}
            />
            <Kb.ConnectedUsernames
              colorBroken={true}
              colorFollowing={true}
              colorYou={true}
              type="BodySmallSemibold"
              usernames={[this.props.message.author]}
              onUsernameClicked="profile"
            />
            <Kb.Text type="BodyTiny">{formatTimeForChat(this.props.message.timestamp)}</Kb.Text>
          </Kb.Box2>
          <Kb.Box2
            direction="vertical"
            fullWidth={true}
            style={styles.contentUnderAuthorContainer}
            gap="tiny"
          >
            {children}
          </Kb.Box2>
        </>
      )
    } else {
      return children
    }
  }

  _unfurlPrompts = () =>
    this.props.hasUnfurlPrompts && (
      <UnfurlPromptList conversationIDKey={this.props.conversationIDKey} ordinal={this.props.ordinal} />
    )

  _unfurlList = () =>
    this.props.message.unfurls &&
    !this.props.message.unfurls.isEmpty() && (
      <UnfurlList conversationIDKey={this.props.conversationIDKey} ordinal={this.props.ordinal} />
    )

  _reactionsRow = () =>
    this.props.message.reactions &&
    !this.props.message.reactions.isEmpty() && (
      <ReactionsRow conversationIDKey={this.props.conversationIDKey} ordinal={this.props.ordinal} />
    )

  _popup = () =>
    (this.props.message.type === 'text' ||
      this.props.message.type === 'attachment' ||
      this.props.message.type === 'sendPayment' ||
      this.props.message.type === 'requestPayment') &&
    this.props.shouldShowPopup && (
      <MessagePopup
        attachTo={this.props.getAttachmentRef}
        message={this.props.message}
        onHidden={this.props.toggleShowingMenu}
        position="top center"
        visible={this.props.showingMenu}
      />
    )

  _containerProps = () => {
    if (Styles.isMobile) {
      if (this.props.decorate) {
        return {
          onLongPress: this.props.toggleShowingMenu,
          onPress: this._dismissKeyboard,
          underlayColor: Styles.globalColors.blue5,
        }
      }
    } else {
      return {
        className: Styles.classNames('WrapperMessage-hoverBox', {
          'WrapperMessage-author': this.props.isShowingUsername, // TODO mobile
          'WrapperMessage-decorated': this.props.decorate,
          active: this.props.showingMenu || this.state.showingPicker,
        }),
      }
    }
  }

  _cachedMenuStyles = {}
  _menuAreaStyle = () => {
    // $ForceType
    const exploding: boolean = this.props.message.exploding
    const iconSizes = [
      this.props.isRevoked ? 16 : 0, // revoked
      16, // reactji
      16, // ... menu
      exploding ? 46 : 0, // exploding
    ].filter(Boolean)
    const padding = 8
    const width =
      iconSizes.length <= 0 ? 0 : iconSizes.reduce((total, size) => total + size, iconSizes.length * padding)

    const key = `${width}:${this.props.isShowingUsername ? 1 : 0}`

    if (!this._cachedMenuStyles[key]) {
      this._cachedMenuStyles[key] = Styles.collapseStyles([
        styles.menuButtons,
        {width},
        this.props.isShowingUsername && styles.menuButtonsWithAuthor,
      ])
    }
    return this._cachedMenuStyles[key]
  }

  _messageAndButtons = () => {
    const showMenuButton = !Styles.isMobile && this.state.showMenuButton
    // $ForceType
    const exploding: boolean = this.props.message.exploding

    if (this.props.decorate && !this.props.exploded) {
      return (
        <Kb.Box2 direction="horizontal" fullWidth={true}>
          {this.props.children}
          <Kb.Box2 direction="horizontal" style={this._menuAreaStyle()} gap="tiny" gapStart={true}>
            {showMenuButton && (
              <Kb.Box className="WrapperMessage-buttons">
                <ReactButton
                  conversationIDKey={this.props.conversationIDKey}
                  ordinal={this.props.ordinal}
                  onShowPicker={this._setShowingPicker}
                  showBorder={false}
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
            )}
            {exploding && (
              <ExplodingMeta
                conversationIDKey={this.props.conversationIDKey}
                onClick={this.props.toggleShowingMenu}
                ordinal={this.props.message.ordinal}
              />
            )}
            {this.props.isRevoked && (
              <Kb.Icon type="iconfont-exclamation" color={Styles.globalColors.blue} fontSize={14} />
            )}
          </Kb.Box2>
        </Kb.Box2>
      )
    } else {
      return this.props.children
    }
  }

  render() {
    return (
      <React.Fragment>
        <LongPressable
          direction="vertical"
          fullWidth={true}
          onMouseOver={this._onMouseOver}
          {...this._containerProps()}
        >
          {this._orangeLine()}
          {this._content([
            this._messageAndButtons(this.props.children),
            this._unfurlPrompts(),
            this._unfurlList(),
            this._reactionsRow(),
          ])}
        </LongPressable>
        {this._popup()}
      </React.Fragment>
    )
  }
}

const WrapperMessage = Kb.OverlayParentHOC(_WrapperMessage)

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    isElectron: {
      marginLeft: Styles.globalMargins.small,
      marginTop: -Styles.globalMargins.tiny,
    },
  }),
  authorContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  contentUnderAuthorContainer: Styles.platformStyles({
    isElectron: {
      paddingLeft:
        // Space for below the avatar
        Styles.globalMargins.tiny + // right margin
        Styles.globalMargins.small + // left margin
        Styles.globalMargins.mediumLarge, // avatar
      marginTop: -Styles.globalMargins.tiny,
    },
  }),
  menuButtons: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      flexShrink: 0,
      height: 16,
      justifyContent: 'flex-end',
      overflow: 'hidden',
    },
  }),
  menuButtonsWithAuthor: {marginTop: -16},
  ellipsis: {marginLeft: Styles.globalMargins.tiny},
})

export default WrapperMessage
