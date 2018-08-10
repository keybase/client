// @flow
import * as React from 'react'
import * as Types from '../../../../../constants/types/chat2'
import {Box, Box2, Icon, OverlayParentHOC, type OverlayParentProps} from '../../../../../common-adapters'
import Timestamp from '../timestamp'
import {
  glamorous,
  globalStyles,
  globalColors,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../../../../../styles'
import WrapperAuthor from '../wrapper-author/container'
import ReactionsRow from '../../reactions-row/container'
import ReactButton from '../../react-button/container'
import MessagePopup from '../../message-popup'
import ExplodingMeta from '../exploding-meta/container'
import LongPressable from './long-pressable'

/**
 * WrapperTimestamp adds the orange line, timestamp, menu button, menu, reacji
 * button, and exploding meta tag.
 */

export type Props = {|
  conversationIDKey: Types.ConversationIDKey,
  decorate: boolean,
  exploded: boolean,
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

const HoverBox = isMobile
  ? LongPressable
  : glamorous(Box2)(props => ({
      '& .menu-button': {
        flexShrink: 0,
        height: 17,
        opacity: 0,
        visibility: 'hidden',
      },
      '&.active .menu-button, &:hover .menu-button': {
        opacity: 1,
        visibility: 'visible',
      },
      '&.active, &:hover': props.decorate
        ? {
            backgroundColor: globalColors.blue5,
          }
        : {},
    }))

type State = {
  showingPicker: boolean,
}
class _WrapperTimestamp extends React.Component<Props & OverlayParentProps, State> {
  state = {showingPicker: false}
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
  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
  render() {
    const props = this.props
    return (
      <Box style={styles.container}>
        {props.orangeLineAbove && <Box style={styles.orangeLine} />}
        {props.timestamp && <Timestamp timestamp={props.timestamp} />}
        <HoverBox
          className={props.showingMenu || this.state.showingPicker ? 'active' : ''}
          {...(isMobile && props.decorate
            ? {onLongPress: props.toggleShowingMenu, underlayColor: globalColors.blue5}
            : {})}
          direction="column"
          decorate={props.decorate}
          fullWidth={true}
        >
          {/* Additional Box here because NativeTouchableHighlight only supports one child */}
          <Box>
            <Box2 direction="horizontal" fullWidth={true} style={styles.alignItemsFlexEnd}>
              {props.type === 'children' && props.children}
              {/* Additional checks on props.message.type to appease flow */}
              {props.type === 'wrapper-author' &&
                (props.message.type === 'attachment' || props.message.type === 'text') && (
                  <WrapperAuthor
                    message={props.message}
                    previous={props.previous}
                    isEditing={props.isEditing}
                    measure={props.measure}
                    toggleMessageMenu={props.toggleShowingMenu}
                  />
                )}
              {!props.exploded &&
                props.decorate && (
                  <MenuButtons
                    conversationIDKey={props.conversationIDKey}
                    message={props.message}
                    ordinal={props.ordinal}
                    setAttachmentRef={props.setAttachmentRef}
                    setShowingPicker={this._setShowingPicker}
                    toggleShowingMenu={props.toggleShowingMenu}
                  />
                )}
            </Box2>
            <ReactionsRow conversationIDKey={props.conversationIDKey} ordinal={props.ordinal} />
          </Box>
        </HoverBox>
        {(props.message.type === 'attachment' || props.message.type === 'text') && (
          <MessagePopup
            attachTo={props.attachmentRef}
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
  message: Types.Message,
  ordinal: Types.Ordinal,
  setAttachmentRef: ?(ref: ?React.Component<any, any>) => void,
  setShowingPicker: boolean => void,
  toggleShowingMenu: () => void,
}
const MenuButtons = (props: MenuButtonsProps) => (
  <Box2 direction="horizontal" gap="tiny" gapEnd={true} style={styles.controls}>
    {!isMobile && (
      <Box className="menu-button" style={styles.menuButtons}>
        <ReactButton
          conversationIDKey={props.conversationIDKey}
          ordinal={props.ordinal}
          onShowPicker={props.setShowingPicker}
          showBorder={false}
          tooltipEnabled={false}
        />
        <Box ref={props.setAttachmentRef}>
          {(props.message.type === 'attachment' || props.message.type === 'text') && (
            <Icon type="iconfont-ellipsis" onClick={props.toggleShowingMenu} fontSize={16} />
          )}
        </Box>
      </Box>
    )}
    <ExplodingMeta
      conversationIDKey={props.conversationIDKey}
      onClick={props.toggleShowingMenu}
      ordinal={props.ordinal}
    />
  </Box2>
)

const styles = styleSheetCreate({
  container: {...globalStyles.flexBoxColumn, width: '100%'},
  controls: platformStyles({
    common: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      marginTop: 2,
    },
  }),
  menuButtons: platformStyles({
    isElectron: {
      ...globalStyles.flexBoxRow,
      alignItems: 'center',
    },
  }),
  orangeLine: {backgroundColor: globalColors.orange, height: 1, width: '100%'},
})

export default WrapperTimestamp
