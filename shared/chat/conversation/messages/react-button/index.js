// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {
  Box2,
  ClickableBox,
  Emoji,
  FloatingBox,
  Icon,
  iconCastPlatformStyles,
  Text,
} from '../../../../common-adapters'
import {
  collapseStyles,
  glamorous,
  globalColors,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
  transition,
  type StylesCrossPlatform,
} from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'

export type Props = {|
  active: boolean,
  conversationIDKey: Types.ConversationIDKey,
  count: number,
  emoji: string,
  onClick: () => void,
  onLongPress?: () => void,
  onMouseLeave?: (evt: SyntheticEvent<Element>) => void,
  onMouseOver?: (evt: SyntheticEvent<Element>) => void,
  ordinal: Types.Ordinal,
  style?: StylesCrossPlatform,
|}

const ButtonBox = glamorous(ClickableBox)({
  ...(isMobile
    ? {}
    : {
        ':hover': {
          backgroundColor: globalColors.blue4,
          borderColor: globalColors.blue,
        },
      }),
  borderColor: globalColors.black_10,
})
const ReactButton = (props: Props) => (
  <ButtonBox
    {...(isMobile ? {onLongPress: props.onLongPress} : null)} // or else desktop will complain
    onMouseLeave={props.onMouseLeave}
    onMouseOver={props.onMouseOver}
    onClick={props.onClick}
    style={collapseStyles([styles.buttonBox, props.active && styles.active, props.style])}
  >
    <Box2 centerChildren={true} fullHeight={true} direction="horizontal" gap="xtiny" style={styles.container}>
      <Box2 direction="horizontal" style={styles.emojiWrapper}>
        <Emoji size={16} emojiName={props.emoji} />
      </Box2>
      <Text type="BodyTinyBold" style={{color: props.active ? globalColors.blue : globalColors.black_40}}>
        {props.count}
      </Text>
    </Box2>
  </ButtonBox>
)

const iconCycle = [
  'iconfont-reacji',
  'iconfont-reacji-wave',
  'iconfont-reacji-heart',
  'iconfont-reacji-sheep',
]
export type NewReactionButtonProps = {|
  onAddReaction: (emoji: string) => void,
  onLongPress?: () => void,
  onOpenEmojiPicker: () => void,
  showBorder: boolean,
  style?: StylesCrossPlatform,
|}
type NewReactionButtonState = {|
  attachmentRef: ?React.Component<any, any>,
  hovering: boolean,
  iconIndex: number,
  showingPicker: boolean,
|}
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {attachmentRef: null, hovering: false, iconIndex: 0, showingPicker: false}
  _intervalID: ?IntervalID

  _setShowingPicker = (showingPicker: boolean) =>
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))

  _onAddReaction = ({colons}: {colons: string}, evt: Event) => {
    evt.stopPropagation()
    this.props.onAddReaction(colons)
    this._setShowingPicker(false)
    this._stopCycle()
  }

  _onShowPicker = (evt: SyntheticEvent<Element>) => {
    if (isMobile) {
      this.props.onOpenEmojiPicker()
      return
    }
    evt.stopPropagation()
    this._setShowingPicker(true)
  }

  _startCycle = () => {
    if (!this._intervalID) {
      this._intervalID = setInterval(this._nextIcon, 1000)
      this.setState(s => (s.hovering ? null : {hovering: true}))
    }
  }

  _stopCycle = () => {
    this._intervalID && clearInterval(this._intervalID)
    this._intervalID = null
    this.setState(s => (s.iconIndex === 0 && !s.hovering ? null : {hovering: false, iconIndex: 0}))
  }

  _nextIcon = () => this.setState(s => ({iconIndex: (s.iconIndex + 1) % iconCycle.length}))

  componentWillUnmount() {
    this._stopCycle()
  }

  render() {
    const ContainerComp = this.props.showBorder ? ButtonBox : ClickableBox
    return (
      <ContainerComp
        {...(isMobile ? {onLongPress: this.props.onLongPress} : null)} // or else desktop will complain
        onClick={this._onShowPicker}
        onMouseLeave={this._stopCycle}
        onMouseEnter={this._startCycle}
        style={collapseStyles([
          styles.newReactionButtonBox,
          this.props.showBorder && styles.buttonBox,
          this.props.style,
        ])}
      >
        <Box2
          ref={attachmentRef => this.setState(s => (s.attachmentRef ? null : {attachmentRef}))}
          centerChildren={true}
          fullHeight={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          <Icon
            type={iconCycle[this.state.iconIndex]}
            color={this.state.hovering ? globalColors.black_60 : globalColors.black_40}
            fontSize={16}
            style={iconCastPlatformStyles(styles.emojiIconWrapper)}
          />
        </Box2>
        {this.state.showingPicker &&
          !isMobile && (
            <FloatingBox
              attachTo={this.state.attachmentRef}
              position="bottom left"
              onHidden={() => this._setShowingPicker(false)}
            >
              <Picker
                autoFocus={true}
                emoji="star-struck"
                title="reacjibase"
                onClick={this._onAddReaction}
                backgroundImageFn={backgroundImageFn}
              />
            </FloatingBox>
          )}
      </ContainerComp>
    )
  }
}

const styles = styleSheetCreate({
  active: {
    backgroundColor: globalColors.blue4,
    borderColor: globalColors.blue,
  },
  buttonBox: {
    borderRadius: isMobile ? 15 : 12,
    borderStyle: 'solid',
    borderWidth: 2,
    height: isMobile ? 30 : 24,
    ...transition('border-color', 'background-color'),
  },
  container: platformStyles({
    common: {
      paddingLeft: 6,
      paddingRight: 6,
    },
    isElectron: {
      paddingBottom: globalMargins.tiny,
      paddingTop: globalMargins.tiny,
    },
  }),
  emojiIconWrapper: platformStyles({
    isMobile: {marginTop: 2},
  }),
  emojiWrapper: platformStyles({
    isMobile: {marginTop: -2},
  }),
  newReactionButtonBox: {
    width: 37,
  },
})

export default ReactButton
