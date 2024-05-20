import * as React from 'react'
import * as Styles from '@/styles'
import {getStyle as getTextStyle} from './text.desktop'
import pick from 'lodash/pick'
import logger from '@/logger'
import {checkTextInfo} from './input.shared'
import type {InternalProps, TextInfo, Selection} from './plain-input'
import {stringToUint8Array} from 'uint8array-extras'

const maybeParseInt = (input: string | number, radix: number): number =>
  typeof input === 'string' ? parseInt(input, radix) : input
// A plain text input component. Handles callbacks, text styling, and auto resizing but
// adds no styling.
class PlainInput extends React.PureComponent<InternalProps> {
  private _input = React.createRef<HTMLTextAreaElement | HTMLInputElement | null>()
  private _isComposingIME: boolean = false
  private mounted: boolean = true

  get value() {
    return this._input.current?.value ?? ''
  }

  // This is controlled if a value prop is passed
  private _controlled = () => typeof this.props.value === 'string'

  private _onChange = ({target: {value = ''}}) => {
    if (this.props.maxBytes) {
      const {maxBytes} = this.props
      if (stringToUint8Array(value).byteLength > maxBytes) {
        return
      }
    }

    this.props.onChangeText?.(value)
    this._autoResize()
  }

  private _autoResizeLast = ''
  private _autoResize = () => {
    if (!this.props.multiline) {
      // no resizing height on single-line inputs
      return
    }

    // Allow textarea to layout automatically
    if (this.props.growAndScroll) {
      return
    }

    const n = this._input.current
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
    this._input.current?.focus()
  }

  clear = () => {
    if (this._input.current) {
      this._input.current.value = ''
    }
  }

  blur = () => {
    this._input.current?.blur()
  }

  isFocused = () => !!this._input.current && document.activeElement === this._input.current

  transformText = (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
    if (this._controlled()) {
      const errMsg =
        'Attempted to use transformText on controlled input component. Use props.value and setSelection instead.'
      logger.error(errMsg)
      throw new Error(errMsg)
    }
    const n = this._input.current
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
      // if we change this immediately it can fail
      setTimeout(() => {
        n.selectionStart = newTextInfo.selection.start
        n.selectionEnd = newTextInfo.selection.end
      }, 1)

      if (reflectChange && this._input.current) {
        this._onChange({target: this._input.current})
      }

      this._autoResize()
    }
  }

  getSelection = () => {
    const n = this._input.current
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
    const n = this._input.current
    if (n) {
      n.selectionStart = s.start
      n.selectionEnd = s.end
    }
  }

  private _onCompositionStart = () => {
    this._isComposingIME = true
  }

  private _onCompositionEnd = () => {
    this._isComposingIME = false
  }

  private _onKeyDown = (e: React.KeyboardEvent) => {
    if (this._isComposingIME) {
      return
    }
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e)
    }
    if (this.props.onEnterKeyDown && e.key === 'Enter' && !(e.shiftKey || e.ctrlKey || e.altKey)) {
      this.props.onEnterKeyDown(e)
    }
  }

  private _onKeyUp = (e: React.KeyboardEvent) => {
    if (this._isComposingIME) {
      return
    }
    if (this.props.onKeyUp) {
      this.props.onKeyUp(e)
    }
  }

  private _onFocus = () => {
    this.props.onFocus?.()
    this.props.selectTextOnFocus &&
      // doesn't work within the same tick
      setTimeout(
        () =>
          this.mounted &&
          this.setSelection({
            end: this.props.value?.length || 0,
            start: 0,
          })
      )
  }

  private _onBlur = () => {
    this.props.onBlur?.()
  }

  private _getCommonProps = () => {
    const commonProps = {
      ...pick(this.props, ['maxLength', 'value']), // Props we should only passthrough if supplied
      autoFocus: this.props.autoFocus,
      className: Styles.classNames(
        (this.props.allowKeyboardEvents ?? true) && 'mousetrap',
        this.props.className
      ),
      onBlur: this._onBlur,
      onChange: this._onChange,
      onClick: this.props.onClick,
      onCompositionEnd: this._onCompositionEnd,
      onCompositionStart: this._onCompositionStart,
      onFocus: this._onFocus,
      onKeyDown: this._onKeyDown,
      onKeyUp: this._onKeyUp,
      placeholder: this.props.placeholder,
      ref: this._input,
      spellCheck: this.props.spellCheck,
      ...(this.props.disabled ? {readOnly: true} : {}),
    }
    return commonProps
  }

  private _getMultilineProps = () => {
    const rows = this.props.rowsMin || Math.min(2, this.props.rowsMax || 2)
    const textStyle = getTextStyle(this.props.textType ?? 'Body')
    const heightStyles: {minHeight: number; maxHeight?: number; overflowY?: 'hidden'} = {
      minHeight:
        rows * (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20) +
        (this.props.padding ? Styles.globalMargins[this.props.padding] * 2 : 0),
    }
    if (this.props.rowsMax) {
      heightStyles.maxHeight =
        this.props.rowsMax *
        (textStyle.lineHeight === undefined ? 20 : maybeParseInt(textStyle.lineHeight, 10) || 20)
    } else {
      heightStyles.overflowY = 'hidden'
    }

    const paddingStyles = this.props.padding ? Styles.padding(Styles.globalMargins[this.props.padding]) : {}
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
      ]) as React.CSSProperties,
    }
  }

  private _getSinglelineProps = () => {
    const textStyle = getTextStyle(this.props.textType ?? 'Body')
    return {
      ...this._getCommonProps(),
      style: Styles.collapseStyles([
        textStyle,
        styles.noChrome, // noChrome comes after to unset lineHeight in singleline
        this.props.flexable && styles.flexable,
        this.props.style,
      ]) as React.CSSProperties,
      type: this.props.type,
    }
  }

  private _getInputProps = () => {
    return this.props.multiline ? this._getMultilineProps() : this._getSinglelineProps()
  }

  componentDidMount() {
    this.props.globalCaptureKeypress && this._registerBodyEvents(true)
  }

  componentDidUpdate(prevProps: InternalProps) {
    if (this.props.globalCaptureKeypress !== prevProps.globalCaptureKeypress) {
      this._registerBodyEvents(!!this.props.globalCaptureKeypress)
    }
  }

  componentWillUnmount() {
    this._registerBodyEvents(false)
    this.mounted = false
  }

  private _registerBodyEvents = (add: boolean) => {
    const body = document.body
    if (add) {
      body.addEventListener('keydown', this._globalKeyDownHandler)
      body.addEventListener('keypress', this._globalKeyDownHandler)
    } else {
      body.removeEventListener('keydown', this._globalKeyDownHandler)
      body.removeEventListener('keypress', this._globalKeyDownHandler)
    }
  }

  private _globalKeyDownHandler = (ev: KeyboardEvent) => {
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
    const {ref, ...inputProps} = this._getInputProps()
    return (
      <>
        {this.props.multiline ? (
          <textarea {...inputProps} ref={ref as any as React.RefObject<HTMLTextAreaElement>} />
        ) : (
          <input {...inputProps} ref={ref as any as React.RefObject<HTMLInputElement>} />
        )}
      </>
    )
  }
}

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
