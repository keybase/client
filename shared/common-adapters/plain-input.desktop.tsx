import * as React from 'react'
import * as Styles from '../styles'
import {getStyle as getTextStyle} from './text.desktop'
import pick from 'lodash/pick'
import logger from '../logger'
import {_StylesDesktop} from '../styles/css'
import {InternalProps, TextInfo, Selection} from './plain-input'
import {checkTextInfo} from './input.shared'

const maybeParseInt = (input: string | number, radix: number): number =>
  typeof input === 'string' ? parseInt(input, radix) : input
// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends React.PureComponent<InternalProps> {
  _input: HTMLTextAreaElement | HTMLInputElement | null = null
  _isComposingIME: boolean = false

  static defaultProps = {
    textType: 'Body',
  }

  _setInputRef = (ref: HTMLTextAreaElement | HTMLInputElement | null) => {
    this._input = ref
  }

  // This is controlled if a value prop is passed
  _controlled = () => typeof this.props.value === 'string'

  _onChange = ({target: {value = ''}}) => {
    if (this.props.maxBytes) {
      const {maxBytes} = this.props
      if (Buffer.byteLength(value) > maxBytes) {
        return
      }
    }

    this.props.onChangeText && this.props.onChangeText(value)
    this._autoResize()
  }

  _autoResizeLast = ''
  _autoResize = () => {
    if (!this.props.multiline) {
      // no resizing height on single-line inputs
      return
    }

    // Allow textarea to layout automatically
    if (this.props.growAndScroll) {
      return
    }

    const n = this._input
    if (!n) {
      return
    }

    // ignore if value hasn't changed
    if (n.value === this._autoResizeLast) {
      return
    }
    this._autoResizeLast = n.value

    n.style.height = '1px'
    n.style.height = `${n.scrollHeight}px`
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  isFocused = () => !!this._input && document.activeElement === this._input

  transformText = (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
    if (this._controlled()) {
      const errMsg =
        'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const n = this._input
    if (n) {
      const textInfo: TextInfo = {
        selection: {
          end: n.selectionEnd,
          start: n.selectionStart,
        },
        text: n.value,
      }
      const newTextInfo = fn(textInfo)
      checkTextInfo(newTextInfo)
      n.value = newTextInfo.text
      n.selectionStart = newTextInfo.selection.start
      n.selectionEnd = newTextInfo.selection.end

      if (reflectChange && this._input) {
        this._onChange({target: this._input})
      }

      this._autoResize()
    }
  }

  getSelection = () => {
    const n = this._input
    if (n) {
      return {end: n.selectionEnd, start: n.selectionStart}
    }
    return null
  }

  setSelection = (s: Selection) => {
    if (!this._controlled()) {
      const errMsg =
        'Attempted to use setSelection on uncontrolled input component. Use transformText instead'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const n = this._input
    if (n) {
      n.selectionStart = s.start
      n.selectionEnd = s.end
    }
  }

  _onCompositionStart = () => {
    this._isComposingIME = true
  }

  _onCompositionEnd = () => {
    this._isComposingIME = false
  }

  _onKeyDown = (e: React.KeyboardEvent) => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e, this._isComposingIME)
    }
    if (this.props.onEnterKeyDown && e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      this.props.onEnterKeyDown(e)
    }
  }

  _onKeyUp = (e: React.KeyboardEvent) => {
    if (this.props.onKeyUp) {
      this.props.onKeyUp(e, this._isComposingIME)
    }
  }

  _onFocus = () => {
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.props.onBlur && this.props.onBlur()
  }

  _getCommonProps = () => {
    let commonProps: any = {
      ...pick(this.props, ['maxLength', 'value']), // Props we should only passthrough if supplied
      autoFocus: this.props.autoFocus,
      className: this.props.className,
      onBlur: this._onBlur,
      onChange: this._onChange,
      onClick: this.props.onClick,
      onCompositionEnd: this._onCompositionEnd,
      onCompositionStart: this._onCompositionStart,
      onFocus: this._onFocus,
      onKeyDown: this._onKeyDown,
      onKeyUp: this._onKeyUp,
      placeholder: this.props.placeholder,
      placeholderColor: this.props.placeholderColor,
      ref: this._setInputRef,
    }
    if (this.props.disabled) {
      commonProps.readOnly = 'readonly'
    }
    return commonProps
  }

  _getMultilineProps = () => {
    const rows = this.props.rowsMin || Math.min(2, this.props.rowsMax || 2)
    const textStyle: any = getTextStyle(this.props.textType)
    const heightStyles: any = {
      minHeight:
        rows * (maybeParseInt(textStyle.lineHeight, 10) || 20) +
        (this.props.padding ? Styles.globalMargins[this.props.padding] * 2 : 0),
    }
    if (this.props.rowsMax) {
      heightStyles.maxHeight = this.props.rowsMax * (maybeParseInt(textStyle.lineHeight, 10) || 20)
    } else {
      heightStyles.overflowY = 'hidden'
    }

    const paddingStyles: any = this.props.padding
      ? Styles.padding(Styles.globalMargins[this.props.padding])
      : {}
    return {
      ...this._getCommonProps(),
      rows,
      style: Styles.collapseStyles([
        styles.noChrome, // noChrome comes before because we want lineHeight set in multiline
        textStyle,
        styles.multiline,
        heightStyles,
        paddingStyles,
        this.props.resize && styles.resize,
        this.props.growAndScroll && styles.growAndScroll,
        this.props.style,
      ]),
    }
  }

  _getSinglelineProps = () => {
    const textStyle = getTextStyle(this.props.textType)
    return {
      ...this._getCommonProps(),
      style: Styles.collapseStyles([
        textStyle,
        styles.noChrome, // noChrome comes after to unset lineHeight in singleline
        this.props.flexable && styles.flexable,
        this.props.style,
      ]),
      type: this.props.type,
    }
  }

  _getInputProps = () => {
    return this.props.multiline ? this._getMultilineProps() : this._getSinglelineProps()
  }

  componentDidMount = () => {
    this.props.globalCaptureKeypress && this._registerBodyEvents(true)
  }

  componentDidUpdate = (prevProps: InternalProps) => {
    if (this.props.globalCaptureKeypress !== prevProps.globalCaptureKeypress) {
      this._registerBodyEvents(!!this.props.globalCaptureKeypress)
    }
  }

  componentWillUnmount = () => {
    this._registerBodyEvents(false)
  }

  _registerBodyEvents = (add: boolean) => {
    const body = document.body
    if (!body) {
      return
    }
    if (add) {
      body.addEventListener('keydown', this._globalKeyDownHandler)
      body.addEventListener('keypress', this._globalKeyDownHandler)
    } else {
      body.removeEventListener('keydown', this._globalKeyDownHandler)
      body.removeEventListener('keypress', this._globalKeyDownHandler)
    }
  }

  _globalKeyDownHandler = (ev: KeyboardEvent) => {
    const target = ev.target
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      return
    }

    const isPasteKey = ev.key === 'v' && (ev.ctrlKey || ev.metaKey)
    const isValidSpecialKey = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Enter',
    ].includes(ev.key)
    if (ev.type === 'keypress' || isPasteKey || isValidSpecialKey) {
      this.focus()
    }
  }

  render() {
    const inputProps = this._getInputProps()
    return <>{this.props.multiline ? <StyledTextArea {...inputProps} /> : <StyledInput {...inputProps} />}</>
  }
}

// @ts-ignore
const StyledTextArea = Styles.styled.textarea<'textarea'>((props: {placeholderColor: any}) => ({
  '&::-webkit-inner-spin-button': {WebkitAppearance: 'none', margin: 0},
  '&::-webkit-input-placeholder': {color: props.placeholderColor || Styles.globalColors.black_50},
  '&::-webkit-outer-spin-button': {WebkitAppearance: 'none', margin: 0},
}))

// @ts-ignore
const StyledInput = Styles.styled.input<'input'>((props: {placeholderColor: any}) => ({
  '&::-webkit-inner-spin-button': {WebkitAppearance: 'none', margin: 0},
  '&::-webkit-input-placeholder': {color: props.placeholderColor || Styles.globalColors.black_50},
  '&::-webkit-outer-spin-button': {WebkitAppearance: 'none', margin: 0},
}))

const styles = Styles.styleSheetCreate(() => ({
  flexable: {
    flex: 1,
    minWidth: 0,
    // "width: 0" is needed for the input to shrink in flex
    // https://stackoverflow.com/questions/42421361/input-button-elements-not-shrinking-in-a-flex-container
    width: 0,
  },
  growAndScroll: Styles.platformStyles({
    isElectron: {
      maxHeight: '100%',
      overflowY: 'scroll',
    },
  }),
  multiline: Styles.platformStyles({
    isElectron: {
      height: 'initial',
      paddingBottom: 0,
      paddingTop: 0,
      resize: 'none',
      width: '100%',
    },
  }),
  noChrome: Styles.platformStyles({
    isElectron: {
      borderWidth: 0,
      lineHeight: 'unset',
      outline: 'none',
    },
  }),
  resize: Styles.platformStyles({
    isElectron: {resize: 'vertical'},
  }),
}))

export default PlainInput
