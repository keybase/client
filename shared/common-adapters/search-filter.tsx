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
  style?: Styles.StylesCrossPlatform | null
  waiting?: boolean
  onBlur?: (() => void) | null
  onCancel?: (() => void) | null
  // If onClick is provided, this component won't focus on click. User is
  // expected to handle actual filter/search in a separate component, perhaps
  // in a popup.
  onClick?: (() => void) | null
  onFocus?: (() => void) | null
  // following props are ignored when onClick is provided
  hotkey?: 'f' | 'k' | null // desktop only,
  onKeyDown?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
  onKeyUp?: (event: React.KeyboardEvent, isComposingIME: boolean) => void
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

  _inputRef: React.RefObject<any> = React.createRef()
  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }
  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _focus = () => {
    if (this.state.focused) {
      return
    }
    this._inputRef.current && this._inputRef.current.focus()
  }
  _blur = () => {
    this._inputRef.current && this._inputRef.current.blur()
  }
  _clear = () => {
    this._update('')
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
    this.props.hotkey && cmd.endsWith('+' + this.props.hotkey) && this._focus()
  }
  _onKeyDown = (e: React.KeyboardEvent, isComposingIME: boolean) => {
    e.key === 'Escape' && !isComposingIME && this._cancel(e)
    this.props.onKeyDown && this.props.onKeyDown(e, isComposingIME)
  }
  _typing = () => this.state.focused || !!this.state.text

  componentDidMount() {
    this.props.focusOnMount && this._focus()
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
      this.props.hotkey && !this.props.onClick && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}${this.props.hotkey.toUpperCase()})`
        : ''
    return (
      <Kb.NewInput
        value={this.state.text}
        placeholder={this.props.placeholderText + hotkeyText}
        onChangeText={this._update}
        onBlur={this._onBlur}
        onFocus={this._onFocus}
        onKeyDown={this._onKeyDown}
        onKeyUp={this.props.onKeyUp}
        ref={this._inputRef}
        hideBorder={true}
        containerStyle={Styles.collapseStyles([
          styles.inputContainer,
          Styles.isMobile && !this._typing() && styles.inputNoGrow,
        ])}
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
          style={this.props.fullWidth ? styles.spinnerFullWidth : styles.spinnerSmall}
        />
      ))
    )
  }
  _rightCancelIcon() {
    return Styles.isMobile
      ? !!this.state.text && (
          <Kb.Icon
            type="iconfont-remove"
            sizeType={this._iconSizeType()}
            onClick={this._clear}
            color={this._iconColor()}
            style={styles.removeIconNonFullWidth}
          />
        )
      : this._typing() && (
          <Kb.ClickableBox
            onClick={this._cancel}
            style={this.props.fullWidth ? styles.removeIconFullWidth : styles.removeIconNonFullWidth}
          >
            <Kb.Icon type="iconfont-remove" sizeType={this._iconSizeType()} color={this._iconColor()} />
          </Kb.ClickableBox>
        )
  }
  render() {
    const content = (
      <Kb.ClickableBox
        style={Styles.collapseStyles([
          styles.container,
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
          (Styles.isMobile || !this.state.focused ? this._focus : null)
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
        {this._typing() && (
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

const styles = Styles.styleSheetCreate({
  container: Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxRow,
      ...Styles.globalStyles.flexGrow,
      alignItems: 'center',
      borderRadius: Styles.borderRadius,
      flexShrink: 1,
      justifyContent: 'center',
    },
    isElectron: {
      ...Styles.desktopStyles.windowDraggingClickable,
      cursor: 'text',
    },
  }),
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
})
