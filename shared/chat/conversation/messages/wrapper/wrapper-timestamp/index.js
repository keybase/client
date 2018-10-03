// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Box, Box2, Icon, OverlayParentHOC, type OverlayParentProps} from '../../../../../common-adapters'
import {dismiss as dismissKeyboard} from '../../../../../util/keyboard'
import Timestamp from '../timestamp'
import * as Styles from '../../../../../styles'
import WrapperAuthor from '../wrapper-author/container'
import ReactionsRow from '../../reactions-row/container'
import ReactButton from '../../react-button/container'
import MessagePopup from '../../message-popup'
import ExplodingMeta from '../exploding-meta/container'
import LongPressable from './long-pressable'

// Message types that have an ellipsis/meatball menu
const popupableMessageTypes = ['text', 'attachment', 'sendPayment', 'requestPayment']

/**
 * WrapperTimestamp adds the orange line, timestamp, menu button, menu, reacji
 * button, and exploding meta tag.
 */

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  decorate: boolean,
  exploded: boolean,
  isRevoked: boolean,
  ordinal: Types.Ordinal,
  measure: null | (() => void),
  message: Types.Message,
  previous: ?Types.Message,
  children?: React.Node,
  isEditing: boolean,
  timestamp: string,
  // 'children': render children directly
  // 'wrapper-author': additionally render WrapperAuthor and tell it the message type
  type: 'wrapper-author' | 'children',
  orangeLineAbove: boolean,
|}

// TODO flow gets confused since the props are ambiguous
const HoverBox: any = Styles.isMobile ? LongPressable : Box2

type State = {
  showingPicker: boolean,
  showMenuButton: boolean,
}
class _WrapperTimestamp extends React.Component<Props & OverlayParentProps, State> {
  state = {showingPicker: false, showMenuButton: false}
  componentDidUpdate(prevProps: Props) {
    if (this.props.measure) {
      if (
        this.props.orangeLineAbove !== prevProps.orangeLineAbove ||
        this.props.timestamp !== prevProps.timestamp
      ) {
        this.props.measure()
      }
    }
  }
  _onMouseOver = () => {
    this.setState(o => (o.showMenuButton ? null : {showMenuButton: true}))
  }
  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))

  _dismissKeyboard = () => dismissKeyboard()

  render() {
    const props = this.props
    return (
      <Box style={styles.container}>
        {props.orangeLineAbove && <Box style={styles.orangeLine} />}
        {!!props.timestamp && <Timestamp timestamp={props.timestamp} />}
        <HoverBox
          className={[
            'WrapperTimestamp-hoverBox',
            props.showingMenu || this.state.showingPicker ? 'active' : '',
            props.decorate && 'WrapperTimestamp-decorated',
          ]
            .filter(Boolean)
            .join(' ')}
          {...(Styles.isMobile && props.decorate
            ? {
                onPress: this._dismissKeyboard,
                onLongPress: props.toggleShowingMenu,
                underlayColor: Styles.globalColors.blue5,
              }
            : {})}
          {...(Styles.isMobile
            ? {}
            : {
                onMouseOver: this._onMouseOver,
              })}
          direction="vertical"
          fullWidth={true}
        >
          {/* Additional Box here because NativeTouchableHighlight only supports one child */}
          <Box>
            <Box2 direction="horizontal" fullWidth={true} style={styles.alignItemsFlexEnd}>
              {props.type === 'children' && props.children}
              {/* Additional checks on props.message.type to appease flow */}
              {props.type === 'wrapper-author' &&
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
                )}
              {props.decorate &&
                this.state.showMenuButton && (
                  <MenuButtons
                    conversationIDKey={props.conversationIDKey}
                    exploded={props.exploded}
                    isRevoked={props.isRevoked}
                    message={props.message}
                    ordinal={props.ordinal}
                    setAttachmentRef={props.setAttachmentRef}
                    setShowingPicker={this._setShowingPicker}
                    toggleShowingMenu={props.toggleShowingMenu}
                  />
                )}
              {props.decorate && !this.state.showMenuButton && <Box style={styles.menuButtonsPlaceholder} />}
            </Box2>
            {// $FlowIssue doesn't like us not reducing the type here, but its faster
            props.message.reactions &&
              !props.message.reactions.isEmpty() && (
                <ReactionsRow conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />
              )}
          </Box>
        </HoverBox>
        {(props.message.type === 'text' ||
          props.message.type === 'attachment' ||
          props.message.type === 'sendPayment' ||
          props.message.type === 'requestPayment') && (
          <MessagePopup
            attachTo={props.getAttachmentRef}
            message={props.message}
            onHidden={props.toggleShowingMenu}
            position="top center"
            visible={props.showingMenu}
          />
        )}
      </Box>
    )
  }
}
const WrapperTimestamp = OverlayParentHOC(_WrapperTimestamp)

type MenuButtonsProps = {
  conversationIDKey: Types.ConversationIDKey,
  exploded: boolean,
  isRevoked: boolean,
  message: Types.Message,
  ordinal: Types.Ordinal,
  setAttachmentRef: (ref: ?React.Component<any>) => void,
  setShowingPicker: boolean => void,
  toggleShowingMenu: () => void,
}
const MenuButtons = (props: MenuButtonsProps) => (
  <Box2 direction="horizontal" gap="tiny" gapEnd={true} style={styles.controls}>
    {!props.exploded && (
      <Box2 direction="horizontal" centerChildren={true}>
        {props.isRevoked && (
          <Box style={styles.revokedIconWrapper}>
            <Icon type="iconfont-exclamation" color={Styles.globalColors.blue} fontSize={14} />
          </Box>
        )}
        {!Styles.isMobile && (
          <Box className="menu-button" style={styles.menuButtons}>
            <ReactButton
              conversationIDKey={props.conversationIDKey}
              ordinal={props.ordinal}
              onShowPicker={props.setShowingPicker}
              showBorder={false}
              style={styles.reactButton}
            />
            <Box ref={props.setAttachmentRef}>
              {popupableMessageTypes.includes(props.message.type) && (
                <Icon type="iconfont-ellipsis" onClick={props.toggleShowingMenu} fontSize={16} />
              )}
            </Box>
          </Box>
        )}
      </Box2>
    )}
    <ExplodingMeta
      conversationIDKey={props.conversationIDKey}
      onClick={props.toggleShowingMenu}
      ordinal={props.ordinal}
    />
  </Box2>
)

const styles = Styles.styleSheetCreate({
  container: {...Styles.globalStyles.flexBoxColumn, width: '100%'},
  controls: Styles.platformStyles({
    common: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 2,
    },
  }),
  menuButtons: Styles.platformStyles({
    isElectron: {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
    },
  }),
  menuButtonsPlaceholder: {flexShrink: 0, minHeight: 19, minWidth: 69},
  orangeLine: {backgroundColor: Styles.globalColors.orange, height: 1, width: '100%'},
  reactButton: {
    marginTop: -3,
  },
  revokedIconWrapper: {
    marginBottom: 1,
  },
})

export default WrapperTimestamp
