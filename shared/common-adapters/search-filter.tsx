import * as React from 'react'
import Animation from './animation'
import Box, {Box2, Box2Measure} from './box'
import ClickableBox, {ClickableBox2} from './clickable-box'
import NewInput from './new-input'
import {HotKey} from './hot-key'
import PlainInput from './plain-input'
import Text, {type AllowedColors} from './text'
import ProgressIndicator from './progress-indicator'
import Icon, {type IconType} from './icon'
import * as Styles from '@/styles'
import * as Platforms from '@/constants/platform'
import type {NativeSyntheticEvent} from 'react-native'
import type {MeasureRef} from './measure-ref'

const Kb = {
  Animation,
  Box,
  Box2,
  Box2Measure,
  ClickableBox,
  ClickableBox2,
  HotKey,
  Icon,
  NewInput,
  PlainInput,
  ProgressIndicator,
  Text,
}

type Props = {
  icon?: IconType
  iconColor?: AllowedColors
  focusOnMount?: boolean
  size: 'small' | 'full-width' // only affects desktop (https://zpl.io/aMW5AG3)
  onChange?: (text: string) => void
  placeholderText: string
  placeholderCentered?: boolean
  style?: Styles.StylesCrossPlatform
  valueControlled?: boolean
  value?: string
  waiting?: boolean
  mobileCancelButton?: boolean // show "Cancel" on the left
  showXOverride?: boolean
  dummyInput?: boolean
  onBlur?: () => void
  onCancel?: () => void
  // If onClick is provided, this component won't focus on click. User is
  // expected to handle actual filter/search in a separate component, perhaps
  // in a popup.
  onClick?: () => void
  onFocus?: () => void
  // following props are ignored when onClick is provided
  hotkey?: 'f' | 'k' // desktop only,
  // Maps to onSubmitEditing on native
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  onKeyUp?: (event: React.KeyboardEvent) => void
  onKeyPress?: (event: NativeSyntheticEvent<{key: string}>) => void
  measureRef?: React.RefObject<MeasureRef>
}

type State = {
  focused: boolean
  hover: boolean
  text: string
}

class SearchFilter extends React.PureComponent<Props, State> {
  state = {
    // If we recieve the focusOnMount prop, then we can use autoFocus to immediately focus the input element.
    // However we also need to make sure the state is initialized to be focused
    // to prevent an additional render which appears to the user as the search
    // icon and clear button appear/disappearing
    focused: this.props.focusOnMount || false,
    hover: false,
    text: '',
  }

  private mounted = false
  private inputRef: React.RefObject<PlainInput> = React.createRef()
  private onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }
  private onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  private text = () => (this.props.valueControlled ? this.props.value : this.state.text)
  focus = () => {
    // When focusOnMount is true so is state.focused.
    // This is to speed up the focus time when using focusOnMount
    // So continue to focus() the input elemenet if both are true
    if (this.state.focused && !this.props.focusOnMount) {
      return
    }
    this.inputRef.current?.focus()
  }
  blur = () => {
    this.inputRef.current?.blur()
  }
  private clear = () => {
    this.update('')
  }
  private cancel = (e?: React.BaseSyntheticEvent) => {
    this.blur()
    this.props.onCancel ? this.props.onCancel() : this.clear()
    e?.stopPropagation()
  }
  private update = (text: string) => {
    this.setState({text})
    this.props.onChange?.(text)
  }
  private mouseOver = () => this.setState({hover: true})
  private mouseLeave = () => this.setState({hover: false})
  private onHotkey = (cmd: string) => {
    this.props.hotkey && cmd.endsWith('+' + this.props.hotkey) && this.focus()
  }
  private onKeyDown = (e: React.KeyboardEvent) => {
    e.key === 'Escape' && this.cancel(e)
    this.props.onKeyDown && this.props.onKeyDown(e)
  }
  private typing = () => this.state.focused || !!this.text()
  // RN fails at tracking this keyboard if we don't delay this, making it get stuck open.
  private focusOnMount = () => setTimeout(() => this.mounted && this.focus(), 20)
  componentDidMount() {
    this.mounted = true
    this.props.focusOnMount && this.focusOnMount()
  }
  componentWillUnmount() {
    this.mounted = false
  }
  componentDidUpdate(prevProps: Props) {
    // Get focus on the rising edge of focusOnMount even if the component does not remount.
    if (this.props.focusOnMount && !prevProps.focusOnMount) {
      this.focusOnMount()
    }
  }

  private keyHandler() {
    return (
      !Styles.isMobile &&
      this.props.hotkey &&
      !this.props.onClick && <Kb.HotKey onHotKey={this.onHotkey} hotKeys={`mod+${this.props.hotkey}`} />
    )
  }
  private iconSizeType() {
    return !Styles.isMobile && this.props.size === 'full-width' ? 'Default' : 'Small'
  }
  private iconColor() {
    return this.props.iconColor ? this.props.iconColor : Styles.globalColors.black_50
  }
  private leftIcon() {
    return (
      this.props.icon &&
      !this.typing() && (
        <Kb.Icon
          type={this.props.icon}
          sizeType={this.iconSizeType()}
          color={this.iconColor()}
          boxStyle={styles.icon}
          style={!Styles.isMobile && this.props.size === 'small' ? styles.leftIconXTiny : styles.leftIconTiny}
        />
      )
    )
  }
  private input() {
    const hotkeyText =
      this.props.hotkey && !this.props.onClick && !this.state.focused && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}${this.props.hotkey.toUpperCase()})`
        : ''
    return (
      <Kb.NewInput
        autoFocus={this.props.focusOnMount}
        value={this.text()}
        placeholder={this.props.placeholderText + hotkeyText}
        dummyInput={this.props.dummyInput}
        onChangeText={this.update}
        onBlur={this.onBlur}
        onFocus={this.onFocus}
        onKeyDown={this.onKeyDown}
        onKeyUp={this.props.onKeyUp}
        onKeyPress={this.props.onKeyPress}
        onEnterKeyDown={this.props.onEnterKeyDown}
        ref={this.inputRef}
        hideBorder={true}
        containerStyle={styles.inputContainer}
        style={styles.input}
      />
    )
  }
  private waiting() {
    return (
      !!this.props.waiting &&
      (Styles.isMobile ? (
        <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={false} />
      ) : (
        <Kb.Animation
          animationType={'spinner'}
          containerStyle={styles.icon}
          style={this.props.size === 'full-width' ? styles.spinnerFullWidth : styles.spinnerSmall}
        />
      ))
    )
  }
  private rightCancelIcon() {
    let show = this.typing()
    if (this.props.showXOverride === true) {
      show = true
    }
    if (this.props.showXOverride === false) {
      show = false
    }
    if (!show) {
      return null
    }
    if (Styles.isMobile) {
      return (
        <Kb.ClickableBox2 onClick={this.props.mobileCancelButton ? this.clear : this.cancel} hitSlop={10}>
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this.iconSizeType()}
            color={this.iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        </Kb.ClickableBox2>
      )
    } else {
      return (
        <Kb.ClickableBox
          onClick={() => {}}
          // use onMouseDown to work around input's onBlur disappearing the "x" button prior to onClick firing.
          // https://stackoverflow.com/questions/9335325/blur-event-stops-click-event-from-working
          onMouseDown={this.cancel}
          style={
            this.props.size === 'full-width' ? styles.removeIconFullWidth : styles.removeIconNonFullWidth
          }
        >
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this.iconSizeType()}
            color={this.iconColor()}
            boxStyle={styles.icon}
          />
        </Kb.ClickableBox>
      )
    }
  }

  render() {
    const content = (
      <Kb.ClickableBox
        style={Styles.collapseStyles([
          styles.container,
          this.props.placeholderCentered && styles.containerCenter,
          !Styles.isMobile && this.props.size === 'small' && styles.containerSmall,
          (Styles.isMobile || this.props.size === 'full-width') && styles.containerNonSmall,
          this.state.focused || this.state.hover ? styles.light : styles.dark,
          !Styles.isMobile && this.props.style,
        ])}
        onMouseOver={this.mouseOver}
        onMouseLeave={this.mouseLeave}
        onClick={
          this.props.onClick ||
          // On mobile we can't just make a null for Kb.ClickableBox here when
          // focused, as that'd cause PlainInput to be re-constructed.
          (Styles.isMobile || !this.state.focused ? this.focus : undefined)
        }
        underlayColor={Styles.globalColors.transparent}
        hoverColor={Styles.globalColors.transparent}
      >
        <Kb.Box2Measure
          ref={this.props.measureRef}
          direction="horizontal"
          style={Styles.collapseStyles([{alignItems: 'center'}, !Styles.isMobile && {width: '100%'}])}
          pointerEvents={Styles.isMobile && this.props.onClick ? 'none' : undefined}
        >
          {this.keyHandler()}
          {this.leftIcon()}
          {this.input()}
          {this.waiting()}
          {this.rightCancelIcon()}
        </Kb.Box2Measure>
      </Kb.ClickableBox>
    )
    return Styles.isMobile ? (
      <Kb.Box2
        direction="horizontal"
        style={Styles.collapseStyles([styles.containerMobile, this.props.style])}
        alignItems="center"
        gap="xsmall"
      >
        {!!this.props.mobileCancelButton && this.typing() && (
          <Kb.Text type={'BodyBigLink'} onClick={this.cancel}>
            Cancel
          </Kb.Text>
        )}
        {content}
      </Kb.Box2>
    ) : (
      content
    )
  }
}

export default SearchFilter

const styles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.globalStyles.flexGrow,
      alignItems: 'center',
      borderRadius: Styles.borderRadius,
      flexShrink: 1,
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      cursor: 'text',
    },
  }),
  containerCenter: {justifyContent: 'center'},
  containerMobile: Styles.platformStyles({
    common: {
      paddingBottom: Styles.globalMargins.tiny,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
      paddingTop: Styles.globalMargins.tiny,
    },
    isTablet: {
      paddingLeft: 0,
      paddingRight: 0,
    },
  }),
  containerNonSmall: {
    height: 32,
    paddingLeft: Styles.globalMargins.xsmall,
    paddingRight: Styles.globalMargins.xsmall,
  },
  containerSmall: {
    height: 28,
    maxWidth: 280,
    minWidth: 80,
    paddingLeft: Styles.globalMargins.tiny,
    paddingRight: Styles.globalMargins.tiny,
  },
  dark: {backgroundColor: Styles.globalColors.black_10},
  icon: Styles.platformStyles({
    isElectron: {marginTop: 2},
  }),
  input: {backgroundColor: Styles.globalColors.transparent},
  inputContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: Styles.globalColors.transparent,
    flexShrink: 1,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inputNoGrow: {flexGrow: 0},
  leftIconTiny: {marginRight: Styles.globalMargins.tiny},
  leftIconXTiny: {marginRight: Styles.globalMargins.xtiny},
  light: {backgroundColor: Styles.globalColors.black_05},
  removeIconFullWidth: {marginLeft: Styles.globalMargins.xsmall},
  removeIconNonFullWidth: {marginLeft: Styles.globalMargins.tiny},
  spinnerFullWidth: {
    height: 20,
    marginLeft: Styles.globalMargins.xsmall,
    width: 20,
  },
  spinnerMobile: {marginLeft: Styles.globalMargins.tiny},
  spinnerSmall: {
    height: 16,
    marginLeft: Styles.globalMargins.tiny,
    width: 16,
  },
}))
