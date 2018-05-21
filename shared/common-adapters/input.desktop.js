// @flow
import * as React from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.desktop'
import {collapseStyles, globalStyles, globalColors, globalMargins, platformStyles} from '../styles'

import type {Props, Selection, TextInfo} from './input'
import {checkTextInfo} from './input.shared'

type State = {
  focused: boolean,
  // Only used for controlled components.
  value?: string,
}

class Input extends React.PureComponent<Props, State> {
  state: State
  _input: HTMLTextAreaElement | HTMLInputElement | null
  _isComposingIME: boolean = false

  constructor(props: Props) {
    super(props)

    const text = props.value || ''
    this.state = ({
      focused: false,
    }: State)
    if (!props.uncontrolled) {
      this.state.value = text
    }
  }

  _setInputRef = (ref: HTMLTextAreaElement | HTMLInputElement | null) => {
    this._input = ref
  }

  componentDidMount = () => {
    this._autoResize()
  }

  static getDerivedStateFromProps = (nextProps: Props, prevState: State) => {
    if (!nextProps.uncontrolled && nextProps.hasOwnProperty('value')) {
      return {value: nextProps.value || ''}
    }
    return null
  }

  componentDidUpdate = (prevProps: Props, prevState: State) => {
    if (this.state.value !== prevState.value) {
      this._autoResize()
    }
  }

  getValue = (): string => {
    if (this.props.uncontrolled) {
      return this._input ? this._input.value : ''
    } else {
      return this.state.value || ''
    }
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
    this._autoResize()
    if (this.props.uncontrolled) {
      this._onChangeTextDone()
    } else {
      this.setState({value: text}, this._onChangeTextDone)
    }
  }

  _onChange = (event: {target: {value: ?string}}) => {
    this._onChangeText(event.target.value || '')
  }

  _smartAutoresize = {
    pivotLength: -1,
    width: -1,
  }

  _autoResize = () => {
    if (!this.props.multiline) {
      return
    }

    const n = this._input
    if (!n || !n.style) {
      return
    }

    const value = this.getValue()

    // Try and not style/render thrash. We bookkeep the length of the string that was used to go up a line and if we shorten our length
    // we'll remeasure. It's very expensive to just remeasure as the user is typing. it causes a lot of actual layout thrashing
    if (this.props.smartAutoresize) {
      const rect = n.getBoundingClientRect()
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
          this._smartAutoresize.pivotLength = -1
          n.style.height = '1px'
          n.style.height = `${n.scrollHeight}px`
        }
      }
    } else {
      n.style.height = '1px'
      n.style.height = `${n.scrollHeight}px`
    }
  }

  focus = () => {
    const n = this._input
    n && n.focus()
  }

  select = () => {
    const n = this._input
    n && n.select()
  }

  blur = () => {
    const n = this._input
    n && n.blur()
  }

  _transformText = (fn: TextInfo => TextInfo) => {
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

      this._autoResize()
    }
  }

  transformText = (fn: TextInfo => TextInfo) => {
    if (!this.props.uncontrolled) {
      throw new Error('transformText can only be called on uncontrolled components')
    }

    this._transformText(fn)
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
    if (this.props.onEnterKeyDown && e.key === 'Enter' && !e.shiftKey && !this._isComposingIME) {
      if (e.altKey || e.ctrlKey) {
        // If multiline, inject a newline.
        if (this.props.multiline) {
          this._transformText(({text, selection}) => {
            const newText = text.slice(0, selection.start) + '\n' + text.slice(selection.end)
            const pos = selection.start + 1
            const newSelection = {start: pos, end: pos}
            return {
              text: newText,
              selection: newSelection,
            }
          })
          this._onChangeText(this.getValue())
        }
      } else {
        this.props.onEnterKeyDown(e)
      }
    }
  }

  _onKeyUp = (e: SyntheticKeyboardEvent<>) => {
    if (this.props.onKeyUp) {
      this.props.onKeyUp(e, this._isComposingIME)
    }
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
  }

  _onBlur = () => {
    this.setState({focused: false})
    this.props.onBlur && this.props.onBlur()
  }

  _underlineColor = () => {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10
  }

  _rowsToHeight = rows => {
    return rows * _lineHeight + 1 // border
  }

  _containerStyle = underlineColor => {
    return this.props.small
      ? {
          ...globalStyles.flexBoxRow,
          borderBottom: `1px solid ${underlineColor}`,
          width: '100%',
        }
      : {
          ...globalStyles.flexBoxColumn,
          alignItems: 'center',
          marginBottom: globalMargins.small,
          marginTop: globalMargins.small,
        }
  }

  _propTypeToSingleLineType = () => {
    switch (this.props.type) {
      case 'password':
        return 'password'
      default:
        return 'text'
    }
  }

  render = () => {
    const underlineColor = this._underlineColor()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      ...globalStyles.fontSemibold,
      backgroundColor: globalColors.transparent,
      color: globalColors.black_75,
      flex: 1,
      border: 'none',
      outlineWidth: 0,
      ...(this.props.small
        ? {
            textAlign: 'left',
            fontSize: _bodyTextStyle.fontSize,
            fontWeight: _bodyTextStyle.fontWeight,
            lineHeight: _bodyTextStyle.lineHeight,
          }
        : {
            textAlign: 'center',
            fontSize: _headerTextStyle.fontSize,
            fontWeight: _headerTextStyle.fontWeight,
            lineHeight: _headerTextStyle.lineHeight,
            minWidth: 333,
            borderBottom: `1px solid ${underlineColor}`,
          }),
    }

    const inputStyle = {
      ...commonInputStyle,
      maxWidth: 460,
      height: this.props.small ? 18 : 28,
    }

    const textareaStyle = {
      ...commonInputStyle,
      height: 'initial',
      width: '100%',
      resize: 'none',
      wrap: 'off',
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : {overflowY: 'hidden'}),
    }

    const value = this.getValue()

    const floatingHintText =
      !!value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
        ? this.props.floatingHintTextOverride
        : this.props.hintText || ' ')

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
      placeholder: this.props.hintText,
      readOnly: this.props.hasOwnProperty('editable') && !this.props.editable ? 'readonly' : undefined,
      ref: this._setInputRef,
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    if (!this.props.uncontrolled) {
      commonProps.value = value
    }

    const singlelineProps = {
      ...commonProps,
      style: collapseStyles([inputStyle, this.props.inputStyle]),
      type: this._propTypeToSingleLineType(),
    }

    const multilineProps = {
      ...commonProps,
      rows: this.props.rowsMin || defaultRowsToShow,
      style: collapseStyles([textareaStyle, this.props.inputStyle]),
    }

    const smallLabelStyle = collapseStyles([
      globalStyles.fontSemibold,
      {
        fontSize: _bodySmallTextStyle.fontSize,
        lineHeight: `${_lineHeight}px`,
        marginRight: 8,
        color: globalColors.blue,
      },
      this.props.smallLabelStyle,
    ])

    const inputRealCSS = `::-webkit-input-placeholder { color: rgba(0,0,0,.2); }`

    return (
      <Box style={collapseStyles([containerStyle, this.props.style])}>
        <style>{inputRealCSS}</style>
        {!this.props.small &&
          !this.props.hideLabel && (
            <Text type="BodySmallSemibold" style={_floatingStyle}>
              {floatingHintText}
            </Text>
          )}
        {!!this.props.small &&
          !!this.props.smallLabel &&
          !this.props.hideLabel && (
            <Text type="BodySmall" style={smallLabelStyle}>
              {this.props.smallLabel}
            </Text>
          )}
        {this.props.multiline ? <textarea {...multilineProps} /> : <input {...singlelineProps} />}
        {!!this.props.errorText &&
          !this.props.small && (
            <Text type="BodyError" style={collapseStyles([_errorStyle, this.props.errorStyle])}>
              {this.props.errorText}
            </Text>
          )}
      </Box>
    )
  }
}

const _lineHeight = 20
const _headerTextStyle = getTextStyle('Header')
const _bodyTextStyle = getTextStyle('Body')
const _bodySmallTextStyle = getTextStyle('BodySmall')

const _errorStyle = {
  textAlign: 'center',
  width: '100%',
  marginTop: globalMargins.xtiny,
}

const _floatingStyle = platformStyles({
  isElectron: {
    textAlign: 'center',
    minHeight: _bodySmallTextStyle.lineHeight,
    color: globalColors.blue,
    display: 'block',
  },
})

export default Input
