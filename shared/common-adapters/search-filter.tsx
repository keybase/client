import * as React from 'react'
import Animation from './animation'
import {AllowedColors} from './text'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import NewInput from './new-input'
import {HotKey} from './hot-key'
import PlainInput from './plain-input'
import Text from './text'
import ProgressIndicator from './progress-indicator'
import Icon, {IconType} from './icon'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'

const Kb = {
  Animation,
  Box,
  Box2,
  ClickableBox,
  HotKey,
  Icon,
  NewInput,
  PlainInput,
  ProgressIndicator,
  Text,
}

type Props = {
  icon?: IconType | null
  iconColor?: AllowedColors
  focusOnMount?: boolean
  size: 'small' | 'full-width' // only affects desktop (https://zpl.io/aMW5AG3)
  negative?: boolean
  onChange: (text: string) => void
  placeholderText: string
  placeholderCentered?: boolean
  placeholderColor?: AllowedColors
  style?: Styles.StylesCrossPlatform | null
  valueControlled?: boolean
  value?: string
  waiting?: boolean
  mobileCancelButton?: boolean // show "Cancel" on the left
  showXOverride?: boolean | null
  dummyInput?: boolean
  onBlur?: (() => void) | null
  onCancel?: (() => void) | null
  // If onClick is provided, this component won't focus on click. User is
  // expected to handle actual filter/search in a separate component, perhaps
  // in a popup.
  onClick?: (() => void) | null
  onFocus?: (() => void) | null
  // following props are ignored when onClick is provided
  hotkey?: 'f' | 'k' | null // desktop only,
  // Maps to onSubmitEditing on native
  onEnterKeyDown?: (event?: React.BaseSyntheticEvent) => void
  onKeyDown?: (event: React.KeyboardEvent) => void
  onKeyUp?: (event: React.KeyboardEvent) => void
  onKeyPress?: (event: {
    nativeEvent: {
      key: 'Enter' | 'Backspace' | string
    }
  }) => void
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
  private inputRef: React.RefObject<any> = React.createRef()
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
    this.inputRef.current && this.inputRef.current.focus()
  }
  blur = () => {
    this.inputRef.current && this.inputRef.current.blur()
  }
  private clear = () => {
    this.update('')
  }
  private cancel = (e?: any) => {
    this.blur()
    this.props.onCancel ? this.props.onCancel() : this.clear()
    e && e.stopPropagation()
  }
  private update = (text: string) => {
    this.setState({text})
    this.props.onChange(text)
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
    return this.props.iconColor
      ? this.props.iconColor
      : this.props.negative
      ? Styles.globalColors.white_75
      : Styles.globalColors.black_50
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
          style={{
            marginRight:
              !Styles.isMobile && this.props.size === 'small'
                ? Styles.globalMargins.xtiny
                : Styles.globalMargins.tiny,
          }}
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
        style={Styles.collapseStyles([styles.input, !!this.props.negative && styles.textNegative])}
        placeholderColor={
          this.props.placeholderColor
            ? this.props.placeholderColor
            : this.props.negative
            ? Styles.globalColors.white_75
            : ''
        }
      />
    )
  }
  private waiting() {
    return (
      !!this.props.waiting &&
      (Styles.isMobile ? (
        <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={!!this.props.negative} />
      ) : (
        <Kb.Animation
          animationType={this.props.negative ? 'spinnerWhite' : 'spinner'}
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
        <Kb.ClickableBox onClick={this.props.mobileCancelButton ? this.clear : this.cancel}>
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this.iconSizeType()}
            color={this.iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        </Kb.ClickableBox>
      )
    } else {
      return (
        <Kb.ClickableBox
          onClick={Styles.isMobile ? this.cancel : () => {}}
          // use onMouseDown to work around input's onBlur disappearing the "x" button prior to onClick firing.
          // https://stackoverflow.com/questions/9335325/blur-event-stops-click-event-from-working
          onMouseDown={Styles.isMobile ? undefined : this.cancel}
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
          !this.props.negative && (this.state.focused || this.state.hover ? styles.light : styles.dark),
          this.props.negative &&
            (this.state.focused || this.state.hover ? styles.lightNegative : styles.darkNegative),
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
        {this.keyHandler()}
        {this.leftIcon()}
        {this.input()}
        {this.waiting()}
        {this.rightCancelIcon()}
      </Kb.ClickableBox>
    )
    return Styles.isMobile ? (
      <Kb.Box2
        direction="horizontal"
        fullWidth={true}
        style={Styles.collapseStyles([styles.containerMobile, this.props.style])}
        alignItems="center"
        gap="xsmall"
      >
        {!!this.props.mobileCancelButton && this.typing() && (
          <Kb.Text
            type={this.props.negative ? 'BodyBig' : 'BodyBigLink'}
            onClick={this.cancel}
            negative={!!this.props.negative}
          >
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
  containerCenter: {
    justifyContent: 'center',
  },
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
  dark: {
    backgroundColor: Styles.globalColors.black_10,
  },
  darkNegative: {
    backgroundColor: Styles.globalColors.black_20,
  },
  icon: Styles.platformStyles({
    isElectron: {
      marginTop: 2,
    },
  }),
  input: {
    backgroundColor: Styles.globalColors.transparent,
  },
  inputContainer: {
    ...Styles.globalStyles.flexGrow,
    backgroundColor: Styles.globalColors.transparent,
    flexShrink: 1,
    paddingLeft: 0,
    paddingRight: 0,
  },
  inputNoGrow: {
    flexGrow: 0,
  },
  light: {
    backgroundColor: Styles.globalColors.black_05,
  },
  lightNegative: {
    backgroundColor: Styles.globalColors.black_10,
  },
  removeIconFullWidth: {
    marginLeft: Styles.globalMargins.xsmall,
  },
  removeIconNonFullWidth: {
    marginLeft: Styles.globalMargins.tiny,
  },
  spinnerFullWidth: {
    height: 20,
    marginLeft: Styles.globalMargins.xsmall,
    width: 20,
  },
  spinnerMobile: {
    marginLeft: Styles.globalMargins.tiny,
  },
  spinnerSmall: {
    height: 16,
    marginLeft: Styles.globalMargins.tiny,
    width: 16,
  },
  textNegative: {
    color: Styles.globalColors.white,
  },
}))
