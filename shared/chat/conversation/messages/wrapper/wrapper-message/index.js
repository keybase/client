// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import * as Kb from '../../../../../common-adapters'
import {dismiss as dismissKeyboard} from '../../../../../util/keyboard'
import * as Styles from '../../../../../styles'
import WrapperAuthor from '../wrapper-author/container'
import ReactionsRow from '../../reactions-row/container'
import UnfurlPromptList from '../../unfurl/prompt-list/container'
import UnfurlList from '../../unfurl/unfurl-list/container'
import ReactButton from '../../react-button/container'
import MessagePopup from '../../message-popup'
import ExplodingMeta from '../exploding-meta/container'
import LongPressable from './long-pressable'

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

  render() {
    const props = this.props
    const orangeLine = props.orangeLineAbove && <Kb.Box2 direction="vertical" style={styles.orangeLine} />
    const children = props.type === 'children' && props.children

    // Additional checks on props.message.type to appease flow
    const wrapperAuthor = props.type === 'wrapper-author' &&
      (props.message.type === 'attachment' ||
        props.message.type === 'text' ||
        props.message.type === 'sendPayment' ||
        props.message.type === 'requestPayment') && (
        <WrapperAuthor
          message={props.message}
          previous={props.previous}
          isEditing={props.isEditing}
          measure={props.measure}
          toggleMessageMenu={props.toggleShowingMenu}
        />
      )

    const buttons =
      props.decorate &&
      menuButtons({
        conversationIDKey: props.conversationIDKey,
        exploded: props.exploded,
        isRevoked: props.isRevoked,
        isShowingUsername: props.isShowingUsername,
        message: props.message,
        ordinal: props.ordinal,
        setAttachmentRef: props.setAttachmentRef,
        setShowingPicker: this._setShowingPicker,
        shouldShowPopup: props.shouldShowPopup,
        showMenuButton: this.state.showMenuButton,
        toggleShowingMenu: props.toggleShowingMenu,
      })

    const unfurlPrompts = props.hasUnfurlPrompts && (
      <UnfurlPromptList conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />
    )

    // $ForceType
    const unfurls = props.message.unfurls
    const unfurlList = unfurls &&
      !unfurls.isEmpty() && <UnfurlList conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />

    // $ForceType
    const reactions = props.message.reactions
    const reactionsRow = reactions &&
      !reactions.isEmpty() && (
        <ReactionsRow conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />
      )

    const popup = (props.message.type === 'text' ||
      props.message.type === 'attachment' ||
      props.message.type === 'sendPayment' ||
      props.message.type === 'requestPayment') &&
      props.shouldShowPopup && (
        <MessagePopup
          attachTo={props.getAttachmentRef}
          message={props.message}
          onHidden={props.toggleShowingMenu}
          position="top center"
          visible={props.showingMenu}
        />
      )

    const longPressProps = {
      className: Styles.classNames('WrapperMessage-hoverBox', {
        'WrapperMessage-decorated': this.props.decorate,
        active: this.props.showingMenu || this.state.showingPicker,
      }),
      ...(Styles.isMobile && this.props.decorate
        ? {
            onLongPress: this.props.toggleShowingMenu,
            onPress: this._dismissKeyboard,
            underlayColor: Styles.globalColors.blue5,
          }
        : {}),
    }

    return (
      <React.Fragment>
        {orangeLine}
        <LongPressable
          direction="vertical"
          fullWidth={true}
          onMouseOver={this._onMouseOver}
          {...longPressProps}
        >
          <Kb.Box2 direction="horizontal" fullWidth={true}>
            {children}
            {wrapperAuthor}
            {buttons}
          </Kb.Box2>
          {unfurlPrompts}
          {unfurlList}
          {reactionsRow}
        </LongPressable>
        {popup}
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
  container: {
    ...Styles.globalStyles.flexBoxColumn,
    position: 'relative',
    width: '100%',
  },
  controls: Styles.platformStyles({
    common: {
      alignItems: 'center',
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
      alignItems: 'center',
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
