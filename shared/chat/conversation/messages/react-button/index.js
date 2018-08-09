// @flow
import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {
  Box2,
  ClickableBox,
  FloatingBox,
  Icon,
  iconCastPlatformStyles,
  Text,
} from '../../../../common-adapters'
import {EmojiIfExists} from '../../../../common-adapters/markdown.shared'
import * as Styles from '../../../../styles'
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
  style?: Styles.StylesCrossPlatform,
|}

let bounceIn, bounceOut
if (!Styles.isMobile) {
  const glamor = require('glamor')
  bounceIn = glamor.css.keyframes({
    from: {transform: 'translateX(-30px)'},
    to: {transform: 'translateX(-8px)'},
  })
  bounceOut = glamor.css.keyframes({
    from: {transform: 'translateX(-8px)'},
    to: {transform: 'translateX(22px)'},
  })
}

const ButtonBox = Styles.glamorous(ClickableBox)(props => ({
  ...(Styles.isMobile
    ? {}
    : {
        ...(props.border
          ? {
              ':hover': {
                backgroundColor: Styles.globalColors.blue4,
                borderColor: Styles.globalColors.blue,
              },
            }
          : {}),
        '& .centered': {
          animation: `${bounceIn} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) -300ms forwards`,
        },
        '& .offscreen': {
          animation: `${bounceOut} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) -300ms forwards`,
        },
      }),
  borderColor: Styles.globalColors.black_10,
}))
const ReactButton = (props: Props) => (
  <ButtonBox
    {...(Styles.isMobile ? {onLongPress: props.onLongPress} : null)} // or else desktop will complain
    onMouseLeave={props.onMouseLeave}
    onMouseOver={props.onMouseOver}
    onClick={props.onClick}
    style={Styles.collapseStyles([
      styles.borderBase,
      styles.buttonBox,
      props.active && styles.active,
      props.style,
    ])}
  >
    <Box2 centerChildren={true} fullHeight={true} direction="horizontal" gap="xtiny" style={styles.container}>
      <Box2 direction="horizontal" style={styles.emojiWrapper}>
        <EmojiIfExists size={16} lineClamp={1} emojiName={props.emoji} />
      </Box2>
      <Text
        type="BodyTinyBold"
        style={{color: props.active ? Styles.globalColors.blue : Styles.globalColors.black_40}}
      >
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
  style?: Styles.StylesCrossPlatform,
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
    if (Styles.isMobile) {
      this.props.onOpenEmojiPicker()
      return
    }
    evt.stopPropagation()
    this._setShowingPicker(true)
  }

  _startCycle = () => {
    if (!this._intervalID) {
      this._nextIcon()
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
    return (
      <ButtonBox
        {...(Styles.isMobile ? {onLongPress: this.props.onLongPress} : null)} // or else desktop will complain
        border={this.props.showBorder ? 1 : 0}
        onClick={this._onShowPicker}
        onMouseLeave={this._stopCycle}
        onMouseEnter={this._startCycle}
        style={Styles.collapseStyles([
          styles.borderBase,
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
          {Styles.isMobile ? (
            <Icon
              type="iconfont-reacji"
              color={Styles.globalColors.black_40}
              fontSize={16}
              style={iconCastPlatformStyles(styles.emojiIconWrapper)}
            />
          ) : (
            iconCycle.map((iconName, iconIndex) => (
              <Icon
                key={iconName}
                type={iconName}
                color={this.state.hovering ? Styles.globalColors.black_60 : Styles.globalColors.black_40}
                fontSize={16}
                style={iconCastPlatformStyles(
                  Styles.collapseStyles([
                    styles.emojiIconWrapper,
                    !Styles.isMobile && (this.props.showBorder ? {top: 3} : {top: 1}),
                  ])
                )}
                className={this.state.iconIndex === iconIndex ? 'centered' : 'offscreen'}
              />
            ))
          )}
        </Box2>
        {this.state.showingPicker &&
          !Styles.isMobile && (
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
      </ButtonBox>
    )
  }
}

// The first emoji should stay on screen for less time so the user has a better chance of seeing it.
// Set the interval after a shorter initial delay.
// Convenience wrapper around interval + timeout

const styles = Styles.styleSheetCreate({
  active: {
    backgroundColor: Styles.globalColors.blue4,
    borderColor: Styles.globalColors.blue,
  },
  borderBase: {
    borderRadius: Styles.isMobile ? 15 : 12,
    borderStyle: 'solid',
  },
  buttonBox: {
    borderWidth: 2,
    height: Styles.isMobile ? 30 : 24,
    ...Styles.transition('border-color', 'background-color'),
  },
  container: Styles.platformStyles({
    common: {
      paddingLeft: 6,
      paddingRight: 6,
    },
    isElectron: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.tiny,
    },
  }),
  emojiIconWrapper: Styles.platformStyles({
    isElectron: {
      position: 'absolute',
    },
    isMobile: {marginTop: 2},
  }),
  emojiWrapper: Styles.platformStyles({
    isMobile: {marginTop: -2},
  }),
  newReactionButtonBox: Styles.platformStyles({
    common: {
      width: 37,
    },
    isElectron: {
      minHeight: 16,
      overflow: 'hidden',
    },
  }),
})

export default ReactButton
