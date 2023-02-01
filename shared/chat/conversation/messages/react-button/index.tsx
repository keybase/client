import * as React from 'react'
import {Box2, ClickableBox2, Icon, Text, Markdown} from '../../../../common-adapters'
import * as Styles from '../../../../styles'
import DelayInterval from './delay-interval'

export type Props = {
  active: boolean
  className?: string
  count: number
  decorated: string
  emoji: string
  onClick: () => void
  onLongPress?: () => void
  getAttachmentRef?: () => React.Component<any> | null
  style?: Styles.StylesCrossPlatform
}

const markdownOverride = {
  customEmoji: {
    height: Styles.isMobile ? 26 : 18,
    marginTop: Styles.isMobile ? 0 : 4,
    width: Styles.isMobile ? 20 : 18,
  },
  emoji: {
    height: Styles.isMobile ? 20 : 21,
  },
  paragraph: {
    height: Styles.isMobile ? 20 : 18,
    ...(Styles.isMobile ? {} : {display: 'flex', fontSize: 14}),
  },
}

const ReactButton = React.memo(function ReactButton(p: Props) {
  const {decorated, emoji, onLongPress, active, className, onClick} = p
  const {style, count} = p
  const text = decorated.length ? decorated : emoji
  return (
    <ClickableBox2
      className={Styles.classNames('react-button', className, {noShadow: active})}
      onLongPress={onLongPress}
      onClick={onClick}
      style={[styles.borderBase, styles.buttonBox, active && styles.active, style]}
    >
      <Box2 centerChildren={true} fullHeight={true} direction="horizontal" style={styles.container}>
        <Box2 direction="horizontal" style={styles.containerInner} gap="xtiny">
          <Box2 direction="vertical" className="center-emojis">
            <Markdown
              styleOverride={markdownOverride as any}
              lineClamp={1}
              smallStandaloneEmoji={true}
              virtualText={true}
            >
              {text}
            </Markdown>
          </Box2>
          <Text
            type="BodyTinyBold"
            virtualText={true}
            style={Styles.collapseStyles([styles.count, active && styles.countActive])}
          >
            {count}
          </Text>
        </Box2>
      </Box2>
    </ClickableBox2>
  )
})

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
    if (Styles.isMobile) {
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
      <ClickableBox2
        className={Styles.classNames('react-button', {border: this.props.showBorder})}
        onLongPress={this.props.onLongPress}
        onClick={this._onShowPicker}
        style={[
          styles.borderBase,
          styles.newReactionButtonBox,
          this.props.showBorder && styles.buttonBox,
          this.props.style,
        ]}
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
                      ? ({transform: 'translateX(-8px)'} as any)
                      : {transform: 'translateX(22px)'}),
                ])}
                className={this._getClass(iconIndex)}
              />
            ))
          )}
        </Box2>
      </ClickableBox2>
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
        borderColor: Styles.globalColors.black_10,
        borderRadius: Styles.borderRadius,
        borderStyle: 'solid',
      },
      buttonBox: {
        alignItems: 'center',
        backgroundColor: Styles.globalColors.white,
        borderWidth: 1,
        height: Styles.isMobile ? 30 : 24,
        justifyContent: 'center',
        ...Styles.transition('border-color', 'background-color', 'box-shadow'),
      },
      container: {
        height: Styles.isMobile ? 20 : undefined,
        minWidth: 40,
        paddingLeft: 6,
        paddingRight: 6,
      },
      containerInner: {
        alignItems: 'center',
        height: 24,
      },
      count: {
        color: Styles.globalColors.black_50,
        position: 'relative',
      },
      countActive: {color: Styles.globalColors.blueDark},
      emoji: {height: 25},
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
      newReactionButtonBox: Styles.platformStyles({
        common: {width: 37},
        isElectron: {
          minHeight: 18,
          overflow: 'hidden',
        },
      }),
    } as const)
)

export default ReactButton
