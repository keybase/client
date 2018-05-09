// @flow
import * as React from 'react'
import {getStyle as getTextStyle} from './text.desktop'
import {collapseStyles, styleSheetCreate} from '../styles'

import type {Props, Selection, TextInfo} from './plain-input'
import {checkTextInfo} from './plain-input.shared'

type State = {
  value: string,
}

class PlainInput extends React.PureComponent<Props, State> {
  state: State
  _input: HTMLTextAreaElement | HTMLInputElement | null
  _isComposingIME: boolean = false

  constructor(props: Props) {
    super(props)
    const value = props.value || ''
    this.state = ({
      value,
    }: State)
  }

  _setInputRef = (ref: HTMLTextAreaElement | HTMLInputElement | null) => {
    this._input = ref
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    const value = nextProps.value
    if (value === prevState.value) {
      return null
    }
    return {value}
  }

  getValue = (): string => {
    return this.state.value
  }

  selection = (): Selection => {
    const n = this._input
    if (!n) {
      return {start: 0, end: 0}
    }
    const {selectionStart, selectionEnd} = n
    return {start: selectionStart, end: selectionEnd}
  }

  _onChangeTextDone = () => {
    const value = this.getValue()
    this.props.onChangeText && this.props.onChangeText(value)
  }

  _onChangeText = (text: string) => {
    this.setState({value: text}, this._onChangeTextDone)
  }

  _onChange = (event: {target: {value: ?string}}) => {
    this._onChangeText(event.target.value || '')
  }

  _smartAutoresize = {
    pivotLength: -1,
    width: -1,
  }

  focus = () => {
    this._input && this._input.focus()
  }

  select = () => {
    this._input && this._input.select()
  }

  blur = () => {
    this._input && this._input.blur()
  }

  transformText = (fn: TextInfo => TextInfo) => {
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

  render = () => {
    const commonProps: {value?: string} = {
      autoFocus: this.props.autoFocus,
      className: this.props.className,
      onBlur: this._onBlur,
      onClick: this.props.onClick,
      onChange: this._onChange,
      onFocus: this._onFocus,
      onKeyDown: this._onKeyDown,
      onKeyUp: this._onKeyUp,
      onCompositionStart: this._onCompositionStart,
      onCompositionEnd: this._onCompositionEnd,
      placeholder: this.props.placeholder,
      ref: this._setInputRef,
      ...(this.props.disabled ? {readOnly: 'readonly'} : null),
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    const value = this.getValue()
    if (this.props.value) {
      commonProps.value = value
    }

    const textStyle = getTextStyle(this.props.textType || 'Body')

    const singlelineProps = {
      ...commonProps,
      style: collapseStyles([
        textStyle,
        styles.noChrome, // noChrome comes after to unset lineHeight
        this.props.flexable && styles.flexable,
        this.props.style,
      ]),
      type: this.props.type,
    }

    const css = `::-webkit-input-placeholder { color: rgba(0,0,0,.2); }
                 ::-webkit-outer-spin-button, ::-webkit-inner-spin-button {-webkit-appearance: none; margin: 0;}`

    return (
      <React.Fragment>
        <style>{css}</style>
        <input {...singlelineProps} />
      </React.Fragment>
    )
  }
}

const styles = styleSheetCreate({
  flexable: {
    minWidth: 0,
    width: '100%',
    flex: 1,
  },
  noChrome: {borderWidth: 0, lineHeight: 'unset', outline: 'none'},
})

export default PlainInput
