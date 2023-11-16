import * as React from 'react'
import * as Kb from '../../../../common-adapters'
import DelayInterval from './delay-interval'

export type Props = {
  active: boolean
  className?: string
  count: number
  decorated: string
  emoji: string
  onClick: () => void
  onLongPress?: () => void
  style?: Kb.Styles.StylesCrossPlatform
}

const markdownOverride = Kb.Styles.isMobile
  ? {
      customEmoji: {height: 24, width: 24},
      emoji: {height: 24, lineHeight: 24},
      emojiSize: {size: 22},
      paragraph: {},
    }
  : {
      customEmoji: {height: 18, width: 18},
      emoji: {height: 18},
      emojiSize: {size: 18},
      paragraph: {alignSelf: 'center', display: 'flex'},
    }

const ReactButton = React.memo(function ReactButton(p: Props) {
  const {decorated, emoji, onLongPress, active, className, onClick} = p
  const {style, count} = p
  const text = decorated.length ? decorated : emoji
  return (
    <Kb.ClickableBox2
      className={Kb.Styles.classNames('react-button', className, {noShadow: active})}
      onLongPress={onLongPress}
      onClick={onClick}
      style={Kb.Styles.collapseStyles([styles.borderBase, styles.buttonBox, active && styles.active, style])}
    >
      <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal" gap="xtiny">
        <Kb.Box2 centerChildren={true} fullHeight={true} direction="horizontal">
          <Kb.Markdown
            serviceOnlyNoWrap={true}
            styleOverride={markdownOverride as any}
            lineClamp={1}
            smallStandaloneEmoji={true}
            disallowAnimation={false}
            virtualText={true}
          >
            {text}
          </Kb.Markdown>
        </Kb.Box2>
        <Kb.Text
          type="BodyTinyBold"
          virtualText={true}
          style={Kb.Styles.collapseStyles([styles.count, active && styles.countActive])}
        >
          {count}
        </Kb.Text>
      </Kb.Box2>
    </Kb.ClickableBox2>
  )
})

const iconCycle = ['iconfont-reacji', 'iconfont-reacji', 'iconfont-reacji', 'iconfont-reacji'] as const
export type NewReactionButtonProps = {
  onAddReaction: (emoji: string) => void
  onLongPress?: () => void
  onOpenEmojiPicker: () => void
  onShowPicker?: (showing: boolean) => void
  showBorder: boolean
  style?: Kb.Styles.StylesCrossPlatform
}

type NewReactionButtonState = {
  applyClasses: boolean
  hovering: boolean
  iconIndex: number
  showingPicker: boolean
}

// TODO clean this up, this is only used on mobile so all this rotation / hover stuff never happens
export class NewReactionButton extends React.Component<NewReactionButtonProps, NewReactionButtonState> {
  state = {applyClasses: false, hovering: false, iconIndex: 0, showingPicker: false}
  _delayInterval = new DelayInterval(1000, 400)
  _intervalID?: number
  _attachmentRef?: React.Component<any>

  _setShowingPicker = (showingPicker: boolean) => {
    this.setState(s => (s.showingPicker === showingPicker ? null : {showingPicker}))
    this.props.onShowPicker?.(showingPicker)
  }

  _onAddReaction = ({colons}: {colons: string}) => {
    this.props.onAddReaction(colons)
    this._setShowingPicker(false)
    this._stopCycle()
  }

  _onShowPicker = (evt?: React.BaseSyntheticEvent) => {
    if (Kb.Styles.isMobile) {
      this.props.onOpenEmojiPicker()
      return
    }
    evt?.stopPropagation()
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
    this.props.onShowPicker?.(false)
  }

  render() {
    return (
      <Kb.ClickableBox2
        className={Kb.Styles.classNames('react-button', {border: this.props.showBorder})}
        onLongPress={this.props.onLongPress}
        onClick={this._onShowPicker}
        style={Kb.Styles.collapseStyles([
          styles.borderBase,
          styles.newReactionButtonBox,
          this.props.showBorder && styles.buttonBox,
          this.props.style,
        ])}
      >
        <Kb.Box2
          centerChildren={true}
          fullHeight={true}
          direction="horizontal"
          style={this.props.showBorder ? styles.container : null}
        >
          {Kb.Styles.isMobile ? (
            <Kb.Icon
              type="iconfont-reacji"
              color={Kb.Styles.globalColors.black_50}
              fontSize={18}
              style={styles.emojiIconWrapper}
            />
          ) : (
            iconCycle.map((iconName, iconIndex) => (
              <Kb.Icon
                key={iconName}
                type={iconName}
                color={
                  this.state.hovering ? Kb.Styles.globalColors.black_50 : Kb.Styles.globalColors.black_50
                }
                fontSize={18}
                style={Kb.Styles.collapseStyles([
                  styles.emojiIconWrapper,
                  !Kb.Styles.isMobile && (this.props.showBorder ? {top: 4} : {top: 1}),
                  !this.state.applyClasses &&
                    (iconIndex === this.state.iconIndex
                      ? ({transform: 'translateX(-8px)'} as any)
                      : {transform: 'translateX(22px)'}),
                ])}
                className={this._getClass(iconIndex)}
              />
            ))
          )}
        </Kb.Box2>
      </Kb.ClickableBox2>
    )
  }
}

const styles = Kb.Styles.styleSheetCreate(
  () =>
    ({
      active: {
        backgroundColor: Kb.Styles.globalColors.blueLighter2,
        borderColor: Kb.Styles.globalColors.blue,
      },
      borderBase: {
        borderColor: Kb.Styles.globalColors.black_10,
        borderRadius: Kb.Styles.borderRadius,
        borderStyle: 'solid',
      },
      buttonBox: Kb.Styles.platformStyles({
        common: {
          alignItems: 'center',
          backgroundColor: Kb.Styles.globalColors.white,
          borderWidth: 1,
          height: Kb.Styles.isMobile ? 30 : 26,
          justifyContent: 'center',
          minWidth: 40,
          paddingLeft: 6,
          paddingRight: 6,
        },
        isElectron: {...Kb.Styles.transition('border-color', 'background-color', 'box-shadow')},
      }),
      containerInner: {
        alignItems: 'center',
        height: 24,
      },
      count: {
        color: Kb.Styles.globalColors.black_50,
        position: 'relative',
      },
      countActive: {color: Kb.Styles.globalColors.blueDark},
      emoji: {height: 25},
      emojiContainer: Kb.Styles.platformStyles({
        isElectron: {
          ...Kb.Styles.desktopStyles.boxShadow,
          borderRadius: 4,
          marginRight: Kb.Styles.globalMargins.small,
        },
      }),
      emojiIconWrapper: Kb.Styles.platformStyles({
        isElectron: {position: 'absolute'},
        isMobile: {marginTop: 2},
      }),
      newReactionButtonBox: Kb.Styles.platformStyles({
        common: {width: 37},
        isElectron: {
          minHeight: 18,
          overflow: 'hidden',
        },
      }),
    }) as const
)

export default ReactButton
