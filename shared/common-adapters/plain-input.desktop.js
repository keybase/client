// @flow
import * as React from 'react'
import {getStyle as getTextStyle} from './text.desktop'
import {collapseStyles, globalColors, styleSheetCreate, platformStyles} from '../styles'
import {pick} from 'lodash-es'
import logger from '../logger'

import type {_StylesDesktop} from '../styles/css'
import type {InternalProps, TextInfo, Selection} from './plain-input'
import {checkTextInfo} from './input.shared'

let encoder, decoder
if (!__STORYSHOT__) {
  encoder = new window.TextEncoder()
  decoder = new window.TextDecoder('utf-8')
}

// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends React.PureComponent<InternalProps> {
  _input: HTMLTextAreaElement | HTMLInputElement | null
  _isComposingIME: boolean = false
  _lastOnChangeValue: string = this.props.value || ''

  static defaultProps = {
    textType: 'Body',
  }

  _setInputRef = (ref: HTMLTextAreaElement | HTMLInputElement | null) => {
    this._input = ref
  }

  // This is controlled if a value prop is passed
  _controlled = () => typeof this.props.value === 'string'

  _onChange = ({target: {value: _value = ''}}) => {
    let value = _value
    if (this.props.maxBytes) {
      // check we haven't exceeded max bytes
      const {maxBytes} = this.props
      const encoded = encoder.encode(value)
      if (encoded.length > maxBytes) {
        // truncate value, check against past onChangeValue, bail if unchanged
        const truncated = decoder.decode(encoded.slice(0, maxBytes))
        if (truncated === this._lastOnChangeValue) {
          return
        }
        value = truncated
      }
    }

    this._lastOnChangeValue = value
    this.props.onChangeText && this.props.onChangeText(value)
    this._autoResize()
  }

  _smartAutoresize = {
    pivotLength: -1,
    width: -1,
  }

  _autoResize = () => {
    if (!this.props.multiline) {
      // no resizing height on single-line inputs
      return
    }
    const n = this._input
    if (!n) {
      return
    }

    // Smart auto resize algorithm from `Input`, use it by default here
    const rect = n.getBoundingClientRect()
    const value = n.value
    // width changed so throw out our data
    if (rect.width !== this._smartAutoresize.width) {
      this._smartAutoresize.width = rect.width
      this._smartAutoresize.pivotLength = -1
    }

    // See if we've gone up in size, if so keep track of the input at that point
    if (n.scrollHeight > rect.height) {
      this._smartAutoresize.pivotLength = value.length
      n.style.height = `${n.scrollHeight}px`
    } else {
      // see if we went back down in height
      if (this._smartAutoresize.pivotLength !== -1 && value.length <= this._smartAutoresize.pivotLength) {
        this._smartAutoresize.pivotLength = value.length
        n.style.height = '1px'
        n.style.height = `${n.scrollHeight}px`
      }
    }
  }

  focus = () => {
    this._input && this._input.focus()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  transformText = (fn: TextInfo => TextInfo, reflectChange?: boolean) => {
    if (this._controlled()) {
      const errMsg =
        'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const n = this._input
    if (n) {
      const textInfo: TextInfo = {
        text: n.value,
        selection: {
          start: n.selectionStart,
          end: n.selectionEnd,
        },
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
      return {start: n.selectionStart, end: n.selectionEnd}
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

  _onKeyDown = (e: SyntheticKeyboardEvent<>) => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e, this._isComposingIME)
    }
    if (this.props.onEnterKeyDown && e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      this.props.onEnterKeyDown()
    }
  }

  _onKeyUp = (e: SyntheticKeyboardEvent<>) => {
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
      ref: this._setInputRef,
    }
    if (this.props.disabled) {
      commonProps.readOnly = 'readonly'
    }
    return commonProps
  }

  _getMultilineProps = () => {
    const rows = this.props.rowsMin || Math.min(2, this.props.rowsMax || 2)
    const textStyle = getTextStyle(this.props.textType)
    const heightStyles: _StylesDesktop = {
      minHeight: rows * (textStyle.fontSize || 20),
    }
    if (this.props.rowsMax) {
      heightStyles.maxHeight = this.props.rowsMax * (parseInt(textStyle.lineHeight, 10) || 20)
    } else {
      heightStyles.overflowY = 'hidden'
    }
    return {
      ...this._getCommonProps(),
      rows,
      style: collapseStyles([
        styles.noChrome, // noChrome comes before because we want lineHeight set in multiline
        textStyle,
        styles.multiline,
        heightStyles,
        this.props.style,
      ]),
    }
  }

  _getSinglelineProps = () => {
    const textStyle = getTextStyle(this.props.textType)
    return {
      ...this._getCommonProps(),
      style: collapseStyles([
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

  render = () => {
    const inputProps = this._getInputProps()
    const css = `::-webkit-input-placeholder { color: ${this.props.placeholderColor ||
      globalColors.black_40}; }
                 ::-webkit-outer-spin-button, ::-webkit-inner-spin-button {-webkit-appearance: none; margin: 0;}`
    return (
      <React.Fragment>
        <style>{css}</style>
        {this.props.multiline ? <textarea {...inputProps} /> : <input {...inputProps} />}
      </React.Fragment>
    )
  }
}

const styles = styleSheetCreate({
  flexable: {
    flex: 1,
    minWidth: 0,
    width: '100%',
  },
  multiline: platformStyles({
    isElectron: {
      height: 'initial',
      paddingBottom: 0,
      paddingTop: 0,
      resize: 'none',
      width: '100%',
    },
  }),
  noChrome: platformStyles({
    isElectron: {
      borderWidth: 0,
      lineHeight: 'unset',
      outline: 'none',
    },
  }),
})

export default PlainInput
