// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Kb from '../../../../../common-adapters'
import {dismiss as dismissKeyboard} from '../../../../../util/keyboard'
import * as Styles from '../../../../../styles'
import ReactionsRow from '../../reactions-row/container'
import UnfurlPromptList from '../../unfurl/prompt-list/container'
import UnfurlList from '../../unfurl/unfurl-list/container'
import ReactButton from '../../react-button/container'
import MessagePopup from '../../message-popup'
import ExplodingMeta from '../exploding-meta/container'
import LongPressable from './long-pressable'
import {formatTimeForChat} from '../../../../../util/timestamp'

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
  // 'children': render children directly
  // 'wrapper-author': additionally render WrapperAuthor and tell it the message type
  type: 'wrapper-author' | 'children',
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

  _menuButtons = () => {
    this.props.decorate &&
      menuButtons({
        conversationIDKey: this.props.conversationIDKey,
        exploded: this.props.exploded,
        isRevoked: this.props.isRevoked,
        isShowingUsername: this.props.isShowingUsername,
        message: this.props.message,
        ordinal: this.props.ordinal,
        setAttachmentRef: this.props.setAttachmentRef,
        setShowingPicker: this._setShowingPicker,
        shouldShowPopup: this.props.shouldShowPopup,
        showMenuButton: this.state.showMenuButton,
        toggleShowingMenu: this.props.toggleShowingMenu,
      })
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

  _menuAreaWidth = () => {
    const iconSizes = [
      this.props.message.isRevoked ? 16 : 0, // revoked
      16, // reactji
      this.props.showMenuButtons ? 16 : 0, // ... menu
    ].filter(Boolean)
    const padding = 8
    return iconSizes.length <= 0
      ? 0
      : iconSizes.reduce((total, size) => total + size, iconSizes.length - 1 * padding)
  }

  render() {
    // const menuButtons = this._menuButtons()
    // {menuButtons}
    return (
      <React.Fragment>
        <LongPressable
          direction="vertical"
          fullWidth={true}
          onMouseOver={this._onMouseOver}
          {...this._containerProps()}
        >
          {this._orangeLine()}
          <Kb.Box2 direction="horizontal" />
          {this._content([
            this.props.children,
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

type MenuButtonsProps = {
  conversationIDKey: Types.ConversationIDKey,
  exploded: boolean,
  isRevoked: boolean,
  isShowingUsername: boolean,
  message: Types.Message,
  ordinal: Types.Ordinal,
  setAttachmentRef: (ref: ?React.Component<any>) => void,
  setShowingPicker: boolean => void,
  shouldShowPopup: boolean,
  showMenuButton: boolean,
  toggleShowingMenu: () => void,
}
const menuButtons = (props: MenuButtonsProps) => {
  // $ForceType
  const exploding: boolean = props.message.exploding

  return (
    <Kb.Box2
      direction={Styles.isMobile ? 'vertical' : 'horizontal'}
      gap={!Styles.isMobile ? 'tiny' : undefined}
      gapEnd={!Styles.isMobile}
      style={styles.controls}
    >
      {!props.exploded && (
        <Kb.Box2 direction="horizontal" centerChildren={true}>
          {props.isRevoked && (
            <Kb.Box style={styles.revokedIconWrapper}>
              <Kb.Icon type="iconfont-exclamation" color={Styles.globalColors.blue} fontSize={14} />
            </Kb.Box>
          )}
          {!Styles.isMobile && (
            <Kb.Box2 direction="horizontal" style={styles.menuButtonsContainer}>
              {props.showMenuButton && (
                <Kb.Box
                  className="menu-button"
                  style={Styles.collapseStyles([
                    styles.menuButtons,
                    props.isShowingUsername && exploding && styles.menuButtonsPosition,
                  ])}
                >
                  <ReactButton
                    conversationIDKey={props.conversationIDKey}
                    ordinal={props.ordinal}
                    onShowPicker={props.setShowingPicker}
                    showBorder={false}
                    style={styles.reactButton}
                  />
                  <Kb.Box ref={props.setAttachmentRef}>
                    {props.shouldShowPopup && (
                      <Kb.Icon type="iconfont-ellipsis" onClick={props.toggleShowingMenu} fontSize={14} />
                    )}
                  </Kb.Box>
                </Kb.Box>
              )}
            </Kb.Box2>
          )}
        </Kb.Box2>
      )}
      {exploding && (
        <ExplodingMeta
          conversationIDKey={props.conversationIDKey}
          onClick={props.toggleShowingMenu}
          ordinal={props.ordinal}
          style={props.isShowingUsername ? styles.explodingMetaPosition : undefined}
        />
      )}
    </Kb.Box2>
  )
}

const styles = Styles.styleSheetCreate({
  avatar: Styles.platformStyles({
    common: {
      marginTop: Styles.globalMargins.xtiny,
    },
    isElectron: {
      marginLeft: Styles.globalMargins.small,
      marginTop: -Styles.globalMargins.tiny,
    },
    isMobile: {
      // TODO
      marginLeft: 0,
    },
  }),
  authorContainer: Styles.platformStyles({
    common: {
      alignSelf: 'flex-start',
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  contentUnderAuthorContainer: Styles.platformStyles({
    common: {},
    isElectron: {
      paddingLeft:
        // Space for below the avatar
        Styles.globalMargins.tiny + // right margin
        Styles.globalMargins.small + // left margin
        Styles.globalMargins.mediumLarge, // avatar
      marginTop: -Styles.globalMargins.tiny,
    },
    isMobile: {},
  }),
})

const OLDstyles = Styles.styleSheetCreate({
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
    width: '100%',
  },
  controls: Styles.platformStyles({
    common: {
      alignItems: 'center',
      height: '100%',
      maxHeight: '100%',
      marginRight: Styles.globalMargins.tiny,
    },
    isElectron: {
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    isMobile: {
      alignSelf: 'flex-end',
    },
  }),
  explodingMetaPosition: Styles.platformStyles({
    isElectron: {
      bottom: 0,
      position: 'absolute',
      right: Styles.globalMargins.small,
    },
  }),
  menuButtons: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'flex-start',
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }),
  // This contains the menu buttons. The buttons aren't mounted / visible unless you mouse over. Because we don't want their appearance
  // to resize the text and push things around with DOM flow we make this a fixed width and ensure the children (inside .menuButtons) are
  // absolutely positioned. The height is 0 so it never pushes a line of text down
  menuButtonsContainer: {
    flexShrink: 0,
    height: 0,
    position: 'relative',
    width: 53,
  },
  menuButtonsPosition: {
    left: Styles.globalMargins.tiny,
    position: 'relative',
  },
  orangeLine: {backgroundColor: Styles.globalColors.orange, height: 1, width: '100%'},
  reactButton: {
    marginTop: -3,
  },
  revokedIconWrapper: {
    marginBottom: 1,
  },
})

export default WrapperMessage
