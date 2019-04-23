// @flow
import * as React from 'react'
import Box, {Box2} from './box'
import ClickableBox from './clickable-box'
import NewInput from './new-input'
import PlainInput from './plain-input'
import Text from './text'
import ProgressIndicator from './progress-indicator'
import Icon, {type IconType} from './icon'
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

type Props = {|
  icon?: ?IconType,
  focusOnMount?: ?boolean,
  negative?: ?boolean,
  onChange: (text: string) => void,
  placeholderText: string,
  style?: ?Styles.StylesCrossPlatform,
  type: 'Small' | 'Full-width' | 'Mobile',
  waiting?: ?boolean,

  onBlur?: ?() => void,
  // If onClick is provided, this component won't focus on click. User is
  // expected to handle actual filter/search in a separate component, perhaps
  // in a popup.
  onClick?: ?() => void,
  // following props are ignored when onClick is provided
  hotkey?: ?('f' | 'k'), // desktop only
  onKeyDown?: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
  onKeyUp?: (event: SyntheticKeyboardEvent<>, isComposingIME: boolean) => void,
|}

type State = {|
  focused: boolean,
  hover: boolean,
  text: string,
|}

class SearchFilter extends React.PureComponent<Props, State> {
  state = {
    focused: false,
    hover: false,
    text: '',
  }

  _input = React.createRef()
  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }
  _onFocus = () => {
    this.setState({focused: true})
  }

  _focus = () => {
    if (this.state.focused) {
      // Can't just make a null for Kb.ClickableBox as that'd cause
      // PlainInput to be re-constructed.
      return
    }
    this._input.current && this._input.current.focus()
  }
  _blur = () => {
    this._input.current && this._input.current.blur()
  }
  _clear = () => {
    this._update('')
  }
  _cancel = e => {
    this._blur()
    this._clear()
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
  _onKeyDown = (e: SyntheticKeyboardEvent<>, isComposingIME: boolean) => {
    e.key === 'Escape' && !isComposingIME && this._cancel()
    this.props.onKeyDown && this.props.onKeyDown(e, isComposingIME)
  }
  _typing = () => this.state.focused || !!this.state.text

  componentDidMount() {
    this.props.focusOnMount && this._focus()
  }
  render() {
    if (
      (this.props.type === 'Mobile' && !Styles.isMobile) ||
      (this.props.type !== 'Mobile' && Styles.isMobile)
    ) {
      return (
        <Kb.Text type="Header" style={{color: Styles.globalColors.red}}>
          Unsupported type
        </Kb.Text>
      )
    }
    const iconColor = this.props.negative ? Styles.globalColors.white_75 : Styles.globalColors.black_50
    const iconSizeType = this.props.type === 'Full-width' ? 'Default' : 'Small'
    const hotkeyText =
      this.props.hotkey && !this.props.onClick && !Styles.isMobile
        ? ` (${Platforms.shortcutSymbol}+${this.props.hotkey.toUpperCase()})`
        : ''
    const content = (
      <Kb.ClickableBox
        style={Styles.collapseStyles([
          styles.container,
          this.props.type === 'Small' && styles.containerSmall,
          this.props.type !== 'Small' && styles.containerNonSmall,
          !this.props.negative && (this.state.focused || this.state.hover ? styles.light : styles.dark),
          this.props.negative &&
            (this.state.focused || this.state.hover ? styles.lightNegative : styles.darkNegative),
          !Styles.isMobile && this.props.style,
        ])}
        onMouseOver={this._mouseOver}
        onMouseLeave={this._mouseLeave}
        onClick={this.props.onClick || this._focus}
        underlayColor={Styles.globalColors.transparent}
        hoverColor={Styles.globalColors.transparent}
      >
        {!Styles.isMobile && this.props.hotkey && !this.props.onClick && (
          <KeyHandler
            onHotkey={this._onHotkey}
            hotkeys={[(Platforms.isDarwin ? 'command+' : 'ctrl+') + this.props.hotkey]}
          />
        )}
        {this.props.icon && !this._typing() && (
          <Kb.Icon
            type={this.props.icon}
            sizeType={iconSizeType}
            color={iconColor}
            style={{
              marginRight:
                this.props.type === 'Small' ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
            }}
          />
        )}
        <Kb.NewInput
          value={this.state.text}
          placeholder={this.props.placeholderText + hotkeyText}
          onChangeText={this._update}
          onBlur={this._onBlur}
          onFocus={this._onFocus}
          onKeyDown={this._onKeyDown}
          onKeyUp={this.props.onKeyUp}
          ref={this._input}
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
        {!!this.props.waiting &&
          (this.props.type === 'Mobile' ? (
            <Kb.ProgressIndicator type="Small" style={styles.spinnerMobile} white={!!this.props.negative} />
          ) : (
            <Kb.Icon
              type={this.props.negative ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
              style={this.props.type === 'Small' ? styles.spinnerSmall : styles.spinnerFullWidth}
            />
          ))}
        {Styles.isMobile && !!this.state.text && (
          <Kb.Icon
            type="iconfont-remove"
            sizeType={iconSizeType}
            onClick={this._clear}
            color={iconColor}
            style={
              this.props.type === 'Full-width' ? styles.removeIconFullWidth : styles.removeIconNonFullWidth
            }
          />
        )}
        {!Styles.isMobile && this._typing() && (
          <Kb.ClickableBox
            onClick={this._cancel}
            style={
              this.props.type === 'Full-width' ? styles.removeIconFullWidth : styles.removeIconNonFullWidth
            }
          >
            <Kb.Icon type="iconfont-remove" sizeType={iconSizeType} color={iconColor} />
          </Kb.ClickableBox>
        )}
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
