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
  EmojiIfExists,
} from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import {Picker} from 'emoji-mart'
import {backgroundImageFn} from '../../../../common-adapters/emoji'
import DelayInterval from './delay-interval'

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
          animation: `${bounceIn} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
        },
        '& .offscreen': {
          animation: `${bounceOut} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`,
        },
      }),
  borderColor: Styles.globalColors.black_10,
}))
const ReactButton = (props: Props) => (
  <ButtonBox
    onLongPress={props.onLongPress}
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
  onShowPicker?: (showing: boolean) => void,
  showBorder: boolean,
  style?: Styles.StylesCrossPlatform,
|}
type NewReactionButtonState = {|
  applyClasses: boolean, // don't use classes on first mount. Saves on performance and prevents animation thrashing
  hovering: boolean,
  iconIndex: number,
  showingPicker: boolean,
|}
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {applyClasses: false, hovering: false, iconIndex: 0, showingPicker: false}
  _delayInterval = new DelayInterval(1000, 400)
  _intervalID: ?IntervalID
  _attachmentRef: ?React.Component<any>

  _setShowingPicker = (showingPicker: boolean) => {
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
    this.props.onShowPicker && this.props.onShowPicker(showingPicker)
  }

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
    if (!this._delayInterval.running()) {
      this._delayInterval.start(this._nextIcon)
      this.setState(s => (s.hovering ? null : {hovering: true}))
    }
  }

  _stopCycle = () => {
    this._delayInterval.stop()
    this.setState(s => (s.iconIndex === 0 && !s.hovering ? null : {hovering: false, iconIndex: 0}))
  }

  _nextIcon = () =>
    this.setState(s => ({applyClasses: true, iconIndex: (s.iconIndex + 1) % iconCycle.length}))

  _getClass = iconIndex => {
    if (!this.state.applyClasses) {
      return ''
    }
    if (iconIndex !== this.state.iconIndex) {
      return 'offscreen'
    }
    return 'centered'
  }

  componentWillUnmount() {
    this._stopCycle()
    this.props.onShowPicker && this.props.onShowPicker(false)
  }

  _getAttachmentRef = () => this._attachmentRef

  render() {
    return (
      <ButtonBox
        onLongPress={this.props.onLongPress}
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
          ref={attachmentRef => (this._attachmentRef = attachmentRef)}
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
                    !this.state.applyClasses &&
                      (iconIndex === this.state.iconIndex
                        ? {transform: 'translateX(-8px)'}
                        : {transform: 'translateX(22px)'}),
                  ])
                )}
                className={this._getClass(iconIndex)}
              />
            ))
          )}
        </Box2>
        {this.state.showingPicker &&
          !Styles.isMobile && (
            <FloatingBox
              attachTo={this._getAttachmentRef}
              containerStyle={styles.emojiContainer}
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

const styles = Styles.styleSheetCreate({
  active: {
    backgroundColor: Styles.globalColors.blue4,
    borderColor: Styles.globalColors.blue,
  },
  borderBase: {
    borderRadius: Styles.borderRadius,
    borderStyle: 'solid',
  },
  buttonBox: {
    backgroundColor: Styles.globalColors.white,
    borderWidth: 1,
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
  emojiContainer: Styles.platformStyles({
    isElectron: {
      borderRadius: 4,
      boxShadow: `0 0 8px 0 ${Styles.globalColors.black_20}`,
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
      width: 16,
      minHeight: 18,
      overflow: 'hidden',
    },
  }),
})

export default ReactButton
