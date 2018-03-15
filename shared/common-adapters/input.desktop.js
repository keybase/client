// @flow
import * as React from 'react'
import {findDOMNode} from 'react-dom'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.desktop'
import {globalStyles, globalColors, globalMargins, platformStyles} from '../styles'

import type {Props} from './input'

type State = {
  value: string,
  focused: boolean,
}

class Input extends React.PureComponent<Props, State> {
  state: State
  _input: *
  _isComposingIME: boolean = false

  constructor(props: Props) {
    super(props)

    this.state = {
      focused: false,
      value: props.value || '',
    }
  }

  setNativeProps(props: Object) {
    throw new Error('Only implemented on RN')
  }

  componentDidMount() {
    this._autoResize()
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.hasOwnProperty('value')) {
      this.setState({value: nextProps.value || ''})
    }
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (this.state.value !== prevState.value) {
      this._autoResize()
    }
  }

  getValue = (): string => {
    return this.state.value || ''
  }

  setValue = (value: string) => {
    this.setState({value: value || ''})
  }

  clearValue = () => {
    this._onChange({target: {value: ''}})
  }

  selections = () => {
    const node = this._input && this._inputNode()
    if (node) {
      const {selectionStart, selectionEnd} = node
      return {selectionStart, selectionEnd}
    }
  }

  _onChange = (event: {target: {value: ?string}}) => {
    this.setState({value: event.target.value || ''})
    this._autoResize()

    this.props.onChangeText && this.props.onChangeText(event.target.value || '')
  }

  _smartAutoresize = {
    pivotLength: -1,
    width: -1,
  }

  _autoResize = () => {
    if (!this.props.multiline) {
      return
    }

    const node = this._inputNode()
    if (!node || !node.style) {
      return
    }

    // Try and not style/render thrash. We bookkeep the length of the string that was used to go up a line and if we shorten our length
    // we'll remeasure. It's very expensive to just remeasure as the user is typing. it causes a lot of actual layout thrashing
    if (this.props.smartAutoresize) {
      const rect = node.getBoundingClientRect()
      // width changed so throw out our data
      if (rect.width !== this._smartAutoresize.width) {
        this._smartAutoresize.width = rect.width
        this._smartAutoresize.pivotLength = -1
      }

      // See if we've gone up in size, if so keep track of the input at that point
      if (node.scrollHeight > rect.height) {
        this._smartAutoresize.pivotLength = this.state.value.length
        node.style.height = `${node.scrollHeight}px`
      } else {
        // see if we went back down in height
        if (
          this._smartAutoresize.pivotLength !== -1 &&
          this.state.value.length <= this._smartAutoresize.pivotLength
        ) {
          this._smartAutoresize.pivotLength = -1
          node.style.height = '1px'
          node.style.height = `${node.scrollHeight}px`
        }
      }
    } else {
      node.style.height = '1px'
      node.style.height = `${node.scrollHeight}px`
    }
  }

  _inputNode = (): HTMLTextAreaElement | HTMLInputElement | null => {
    const node = findDOMNode(this._input)

    if (node instanceof HTMLTextAreaElement) {
      return node
    }
    if (node instanceof HTMLInputElement) {
      return node
    }

    return null
  }

  focus = () => {
    const n = this._input && this._inputNode()
    n && n.focus()
  }

  select = () => {
    const n = this._input && this._inputNode()
    n && n.select()
  }

  blur = () => {
    const n = this._input && this._inputNode()
    n && n.blur()
  }

  insertTextAtCursor = (text: string) => {
    const n = this._input && this._inputNode()
    const selections = this.selections()
    if (n && selections) {
      const {selectionStart, selectionEnd} = selections
      this.replaceText(text, selectionStart, selectionEnd)
    }
  }

  replaceText = (text: string, startIdx: number, endIdx: number) => {
    const n = this._input && this._inputNode()
    if (n) {
      const v = n.value
      const nextValue = v.slice(0, startIdx) + text + v.slice(endIdx)
      n.value = nextValue
      this.setState({value: nextValue})
      this._autoResize()

      this.props.onChangeText && this.props.onChangeText(nextValue || '')
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

    if (this.props.onEnterKeyDown && e.key === 'Enter' && !e.shiftKey && !this._isComposingIME) {
      if (e.altKey || e.ctrlKey) {
        // inject newline
        this.setValue(this.getValue() + '\n')
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

  render() {
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

    const floatingHintText =
      !!this.state.value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
        ? this.props.floatingHintTextOverride
        : this.props.hintText || ' ')

    const commonProps = {
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
      ref: r => {
        this._input = r
      },
      value: this.state.value,
      ...(this.props.maxLength ? {maxlength: this.props.maxLength} : null),
    }

    const singlelineProps = {
      ...commonProps,
      style: {...inputStyle, ...this.props.inputStyle},
      type: this._propTypeToSingleLineType(),
    }

    const multilineProps = {
      ...commonProps,
      rows: this.props.rowsMin || defaultRowsToShow,
      style: {...textareaStyle, ...this.props.inputStyle},
    }

    const smallLabelStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _bodySmallTextStyle.fontSize,
      lineHeight: `${_lineHeight}px`,
      marginRight: 8,
      color: globalColors.blue,
      ...this.props.smallLabelStyle,
    }

    const inputRealCSS = `::-webkit-input-placeholder { color: rgba(0,0,0,.2); }`

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        <style>{inputRealCSS}</style>
        {!this.props.small && (
          <Text type="BodySmallSemibold" style={_floatingStyle}>
            {floatingHintText}
          </Text>
        )}
        {!!this.props.small &&
          !!this.props.smallLabel && (
            <Text type="BodySmall" style={smallLabelStyle}>
              {this.props.smallLabel}
            </Text>
          )}
        {this.props.multiline ? <textarea {...multilineProps} /> : <input {...singlelineProps} />}
        {!!this.props.errorText &&
          !this.props.small && (
            <Text type="BodyError" style={{..._errorStyle, ...this.props.errorStyle}}>
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
