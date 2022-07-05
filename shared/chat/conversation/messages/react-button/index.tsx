import * as React from 'react'
import * as Types from '../../../../constants/types/chat2'
import {Box2, ClickableBox, Icon, Text, EmojiIfExists} from '../../../../common-adapters'
import {Props as ClickableBoxProps} from '../../../../common-adapters/clickable-box'
import * as Styles from '../../../../styles'
import DelayInterval from './delay-interval'

export type Props = {
  active: boolean
  className?: string
  conversationIDKey: Types.ConversationIDKey
  count: number
  decorated: string
  emoji: string
  onClick: () => void
  onLongPress?: () => void
  onMouseLeave?: (evt: React.SyntheticEvent) => void
  onMouseOver?: (evt: React.SyntheticEvent) => void
  getAttachmentRef?: () => React.Component<any> | null
  ordinal: Types.Ordinal
  style?: Styles.StylesCrossPlatform
}

let bounceIn: any
let bounceOut: any
if (!Styles.isMobile) {
  bounceIn = Styles.styledKeyframes({
    from: {transform: 'translateX(-30px)'},
    to: {transform: 'translateX(-8px)'},
  })
  bounceOut = Styles.styledKeyframes({
    from: {transform: 'translateX(-8px)'},
    to: {transform: 'translateX(22px)'},
  })
}

const ButtonBox = Styles.styled(ClickableBox, {
  shouldForwardProp: prop => prop !== 'noEffect' && prop !== 'border',
})((props: ClickableBoxProps & {border: boolean; noEffect: boolean}) =>
  Styles.isMobile || props.noEffect
    ? {borderColor: Styles.globalColors.black_10}
    : {
        ...(props.border
          ? {
              ':hover': {
                backgroundColor: Styles.globalColors.blueLighter2,
                borderColor: Styles.globalColors.blue,
              },
            }
          : {}),
        '& .centered': {animation: `${bounceIn} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`},
        '& .offscreen': {animation: `${bounceOut} 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards`},
        borderColor: Styles.globalColors.black_10,
      }
)

const standardEmojiPattern = /^:([^:])+:$/

const ReactButton = (props: Props) => {
  const text = props.decorated.length ? props.decorated : props.emoji
  const isStandardEmoji = !!props.emoji.match(standardEmojiPattern)
  return (
    <ButtonBox
      noEffect={false}
      border={false}
      className={Styles.classNames(props.className, {noShadow: props.active})}
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
      <Box2
        centerChildren={true}
        fullHeight={true}
        direction="horizontal"
        gap="xtiny"
        style={styles.container}
      >
        <Box2 direction="horizontal" style={styles.emojiWrapper}>
          <EmojiIfExists
            paragraphTextClassName={Styles.classNames({noLineHeight: isStandardEmoji})}
            size={Styles.isMobile ? 16 : 18}
            lineClamp={1}
            emojiName={text}
          />
        </Box2>
        <Text
          type="BodyTinyBold"
          style={Styles.collapseStyles([styles.count, props.active && styles.countActive])}
        >
          {props.count}
        </Text>
      </Box2>
    </ButtonBox>
  )
}

const iconCycle = ['iconfont-reacji', 'iconfont-reacji', 'iconfont-reacji', 'iconfont-reacji'] as const
export type NewReactionButtonProps = {
  getAttachmentRef?: () => React.Component<any> | null
  onAddReaction: (emoji: string) => void
  onLongPress?: () => void
  onOpenEmojiPicker: () => void
  onShowPicker?: (showing: boolean) => void
  showBorder: boolean
  style?: Styles.StylesCrossPlatform
}

type NewReactionButtonState = {
  applyClasses: boolean
  hovering: boolean
  iconIndex: number
  showingPicker: boolean
}

export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {applyClasses: false, hovering: false, iconIndex: 0, showingPicker: false}
  _delayInterval = new DelayInterval(1000, 400)
  _intervalID?: number
  _attachmentRef?: React.Component<any>

  _setShowingPicker = (showingPicker: boolean) => {
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
    this.props.onShowPicker && this.props.onShowPicker(showingPicker)
  }

  _onAddReaction = ({colons}: {colons: string}) => {
    this.props.onAddReaction(colons)
    this._setShowingPicker(false)
    this._stopCycle()
  }

  _onShowPicker = (evt: React.BaseSyntheticEvent) => {
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

  _getClass = (iconIndex: number) => {
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

  render() {
    return (
      <ButtonBox
        noEffect={false}
        onLongPress={this.props.onLongPress}
        border={this.props.showBorder}
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
          centerChildren={true}
          fullHeight={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          {Styles.isMobile ? (
            <Icon
              type="iconfont-reacji"
              color={Styles.globalColors.black_50}
              fontSize={Styles.isMobile ? 18 : 16}
              style={styles.emojiIconWrapper}
            />
          ) : (
            iconCycle.map((iconName, iconIndex) => (
              <Icon
                key={iconName}
                type={iconName}
                color={this.state.hovering ? Styles.globalColors.black_50 : Styles.globalColors.black_50}
                fontSize={18}
                style={Styles.collapseStyles([
                  styles.emojiIconWrapper,
                  !Styles.isMobile && (this.props.showBorder ? {top: 4} : {top: 1}),
                  !this.state.applyClasses &&
                    (iconIndex === this.state.iconIndex
                      ? {transform: 'translateX(-8px)'}
                      : {transform: 'translateX(22px)'}),
                ])}
                className={this._getClass(iconIndex)}
              />
            ))
          )}
        </Box2>
      </ButtonBox>
    )
  }
}

const styles = Styles.styleSheetCreate(
  () =>
    ({
      active: {
        backgroundColor: Styles.globalColors.blueLighter2,
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
        ...Styles.transition('border-color', 'background-color', 'box-shadow'),
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
      count: {
        color: Styles.globalColors.black_50,
        position: 'relative',
        top: 1,
      },
      countActive: {
        color: Styles.globalColors.blueDark,
      },
      emojiContainer: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.boxShadow,
          borderRadius: 4,
          marginRight: Styles.globalMargins.small,
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
          minHeight: 18,
          overflow: 'hidden',
        },
      }),
    } as const)
)

export default ReactButton
