import * as React from 'react'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import NewInput from './new-input'
import PlainInput from './plain-input'
import Text from './text'
import ProgressIndicator from './progress-indicator'
import Icon, {IconType} from './icon'
import * as Styles from '../styles'
import * as Platforms from '../constants/platform'

const KeyHandler = (Styles.isMobile ? c => c : require('../util/key-handler.desktop').default)(() => null)

const Kb = {
  Box,
  Box2,
  ClickableBox,
  Icon,
  NewInput,
  PlainInput,
  ProgressIndicator,
  Text,
}

type Props = {
  icon?: IconType | null
  focusOnMount?: boolean
  fullWidth?: boolean
  negative?: boolean
  onChange: (text: string) => void
  placeholderText: string
  placeholderCentered?: boolean
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
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
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
    focused: false,
    hover: false,
    text: '',
  }

  _mounted = false
  _inputRef: React.RefObject<any> = React.createRef()
  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }
  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _text = () => (this.props.valueControlled ? this.props.value : this.state.text)
  focus = () => {
    if (this.state.focused) {
      return
    }
    this._inputRef.current && this._inputRef.current.focus()
  }
  _blur = () => {
    this._inputRef.current && this._inputRef.current.blur()
  }
  _clear = () => {
    if (!this.props.valueControlled) {
      this._update('')
    }
  }
  _cancel = (e?: any) => {
    this._blur()
    this._clear()
    this.props.onCancel && this.props.onCancel()
    e && e.stopPropagation()
  }
  _update = text => {
    this.setState({text})
    this.props.onChange(text)
  }
  _mouseOver = () => this.setState({hover: true})
  _mouseLeave = () => this.setState({hover: false})
  _onHotkey = cmd => {
    this.props.hotkey && cmd.endsWith('+' + this.props.hotkey) && this.focus()
  }
  _onKeyDown = (e: React.KeyboardEvent, isComposingIME: boolean) => {
    e.key === 'Escape' && !isComposingIME && this._cancel(e)
    this.props.onKeyDown && this.props.onKeyDown(e, isComposingIME)
  }
  _typing = () => this.state.focused || !!this._text()
  // RN fails at tracking this keyboard if we don't delay this, making it get stuck open.
  _focusOnMount = () => setTimeout(() => this._mounted && this.focus(), 20)
  componentDidMount() {
    this._mounted = true
    this.props.focusOnMount && this._focusOnMount()
  }
  componentWillUnmount() {
    this._mounted = false
  }
  componentDidUpdate(prevProps: Props) {
    // Get focus on the rising edge of focusOnMount even if the component does not remount.
    if (this.props.focusOnMount && !prevProps.focusOnMount) {
      this._focusOnMount()
    }
  }
  _keyHandler() {
    return (
      !Styles.isMobile &&
      this.props.hotkey &&
      !this.props.onClick && (
        <KeyHandler
          onHotkey={this._onHotkey}
          hotkeys={[(Platforms.isDarwin ? 'command+' : 'ctrl+') + this.props.hotkey]}
        />
      )
    )
  }
  _iconSizeType() {
    return !Styles.isMobile && this.props.fullWidth ? 'Default' : 'Small'
  }
  _iconColor() {
    return this.props.negative ? Styles.globalColors.white_75 : Styles.globalColors.black_50
  }
  _leftIcon() {
    return (
      this.props.icon &&
      !this._typing() && (
        <Kb.Icon
          type={this.props.icon}
          sizeType={this._iconSizeType()}
          color={this._iconColor()}
          boxStyle={styles.icon}
          style={{
            marginRight:
              !Styles.isMobile && !this.props.fullWidth
                ? Styles.globalMargins.xtiny
                : Styles.globalMargins.tiny,
          }}
        />
      )
    )
  }
  _input() {
    const hotkeyText =
      this.props.hotkey && !this.props.onClick && !this.state.focused && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}${this.props.hotkey.toUpperCase()})`
        : ''
    return (
      <Kb.NewInput
        value={this._text()}
        placeholder={this.props.placeholderText + hotkeyText}
        dummyInput={this.props.dummyInput}
        onChangeText={this._update}
        onBlur={this._onBlur}
        onFocus={this._onFocus}
        onKeyDown={this._onKeyDown}
        onKeyUp={this.props.onKeyUp}
        onKeyPress={this.props.onKeyPress}
        onEnterKeyDown={this.props.onEnterKeyDown}
        ref={this._inputRef}
        hideBorder={true}
        containerStyle={styles.inputContainer}
        style={Styles.collapseStyles([
          styles.input,
          !!this.props.negative && styles.textNegative,
          Styles.isMobile && !this._typing() && styles.inputNoGrow,
        ])}
        placeholderColor={this.props.negative ? Styles.globalColors.white_75 : ''}
      />
    )
  }
  _waiting() {
    return (
      !!this.props.waiting &&
      (Styles.isMobile ? (
        <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={!!this.props.negative} />
      ) : (
        <Kb.Icon
          type={this.props.negative ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
          boxStyle={styles.icon}
          style={this.props.fullWidth ? styles.spinnerFullWidth : styles.spinnerSmall}
        />
      ))
    )
  }
  _rightCancelIcon() {
    let show = this._typing()
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
        <Kb.ClickableBox onClick={this.props.mobileCancelButton ? this._clear : this._cancel}>
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this._iconSizeType()}
            color={this._iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        </Kb.ClickableBox>
      )
    } else {
      return (
        <Kb.ClickableBox
          onClick={Styles.isMobile ? this._cancel : () => {}}
          // use onMouseDown to work around input's onBlur disappearing the "x" button prior to onClick firing.
          // https://stackoverflow.com/questions/9335325/blur-event-stops-click-event-from-working
          onMouseDown={Styles.isMobile ? undefined : this._cancel}
          style={this.props.fullWidth ? styles.removeIconFullWidth : styles.removeIconNonFullWidth}
        >
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this._iconSizeType()}
            color={this._iconColor()}
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
          !Styles.isMobile && !this.props.fullWidth && styles.containerSmall,
          (Styles.isMobile || this.props.fullWidth) && styles.containerNonSmall,
          !this.props.negative && (this.state.focused || this.state.hover ? styles.light : styles.dark),
          this.props.negative &&
            (this.state.focused || this.state.hover ? styles.lightNegative : styles.darkNegative),
          !Styles.isMobile && this.props.style,
        ])}
        onMouseOver={this._mouseOver}
        onMouseLeave={this._mouseLeave}
        onClick={
          this.props.onClick ||
          // On mobile we can't just make a null for Kb.ClickableBox here when
          // focused, as that'd cause PlainInput to be re-constructed.
          (Styles.isMobile || !this.state.focused ? this.focus : undefined)
        }
        underlayColor={Styles.globalColors.transparent}
        hoverColor={Styles.globalColors.transparent}
      >
        {this._keyHandler()}
        {this._leftIcon()}
        {this._input()}
        {this._waiting()}
        {this._rightCancelIcon()}
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
        {!!this.props.mobileCancelButton && this._typing() && (
          <Kb.Text
            type={this.props.negative ? 'BodyBig' : 'BodyBigLink'}
            onClick={this._cancel}
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
  containerMobile: {
    paddingBottom: Styles.globalMargins.tiny,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
    paddingTop: Styles.globalMargins.tiny,
  },
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
    width: undefined,
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
    height: 16,
    marginLeft: Styles.globalMargins.xsmall,
    width: 16,
  },
  spinnerMobile: {
    marginLeft: Styles.globalMargins.tiny,
  },
  spinnerSmall: {
    height: 12,
    marginLeft: Styles.globalMargins.tiny,
    width: 12,
  },
  textNegative: {
    color: Styles.globalColors.white,
  },
}))
