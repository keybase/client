import * as React from 'react'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.desktop'
import {collapseStyles, globalStyles, globalColors, globalMargins, platformStyles} from '../styles'

import {Props, Selection, TextInfo} from './input'
import {checkTextInfo} from './input.shared'

type State = {
  focused: boolean
}

class Input extends React.PureComponent<Props, State> {
  _input: HTMLTextAreaElement | HTMLInputElement | null
  _isComposingIME: boolean = false

  state = {
    focused: false,
  }

  _setInputRef = (ref: HTMLTextAreaElement | HTMLInputElement | null) => {
    this._input = ref
  }

  componentDidMount = () => {
    this._autoResize()
    this.props.autoFocus && this.focus()
  }

  componentDidUpdate = (prevProps: Props, prevState: State) => {
    if (!this.props.uncontrolled && this.props.value !== prevProps.value) {
      this._autoResize()
    }

    if (prevProps.clearTextCounter !== this.props.clearTextCounter) {
      this._clearText()
    }
  }

  _getValue = () => {
    return (this.props.uncontrolled ? this._input && this._input.value : this.props.value) || ''
  }

  _clearText = () => {
    if (!this.props.uncontrolled) {
      throw new Error('clearTextCounter only works on uncontrolled components')
    }

    this.transformText(() => ({
      selection: {end: 0, start: 0},
      text: '',
    }))
  }

  getValue = (): string => {
    if (this.props.uncontrolled) {
      return this._getValue()
    } else {
      throw new Error('getValue only supported on uncontrolled inputs')
    }
  }

  selection = (): Selection => {
    const n = this._input
    if (!n) {
      return {end: 0, start: 0}
    }
    const {selectionStart, selectionEnd} = n
    return {end: selectionEnd, start: selectionStart}
  }

  _onChangeTextDone = value => {
    this.props.onChangeText && this.props.onChangeText(value)
  }

  _onChangeText = (text: string) => {
    this._autoResize()
    this._onChangeTextDone(text)
  }

  _onChange = (event: {
    target: {
      value: string | null
    }
  }) => {
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

    const value = this._getValue()

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
    this.props.selectTextOnFocus && this.select()
  }

  select = () => {
    const n = this._input
    n && n.select()
  }

  blur = () => {
    const n = this._input
    n && n.blur()
  }

  _transformText = (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
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

      if (reflectChange) {
        this._onChangeText(newTextInfo.text)
      }

      this._autoResize()
    }
  }

  transformText = (fn: (textInfo: TextInfo) => TextInfo, reflectChange?: boolean) => {
    if (!this.props.uncontrolled) {
      throw new Error('transformText can only be called on uncontrolled components')
    }

    this._transformText(fn, reflectChange)
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
    if (this.props.onEnterKeyDown && e.key === 'Enter' && !e.shiftKey && !this._isComposingIME) {
      if (e.altKey || e.ctrlKey) {
        // If multiline, inject a newline.
        if (this.props.multiline) {
          this._transformText(({text, selection}) => {
            const newText = text.slice(0, selection.start) + '\n' + text.slice(selection.end)
            const pos = selection.start + 1
            const newSelection = {end: pos, start: pos}
            return {
              selection: newSelection,
              text: newText,
            }
          })
        }
      } else {
        this.props.onEnterKeyDown(e)
      }
    }
  }

  _onKeyUp = (e: React.KeyboardEvent) => {
    if (this.props.onKeyUp) {
      this.props.onKeyUp(e, this._isComposingIME)
    }
  }

  _onFocus = () => {
    this.setState({focused: true})
    this.props.onFocus && this.props.onFocus()
    this.props.selectTextOnFocus && this.select()
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
      border: 'none',
      color: globalColors.black,
      flex: 1,
      outlineWidth: 0,
      ...(this.props.small
        ? {
            fontSize: _bodyTextStyle.fontSize,
            fontWeight: _bodyTextStyle.fontWeight,
            lineHeight: _bodyTextStyle.lineHeight,
            textAlign: 'left',
          }
        : {
            borderBottom: `1px solid ${underlineColor}`,
            fontSize: _headerTextStyle.fontSize,
            fontWeight: _headerTextStyle.fontWeight,
            lineHeight: _headerTextStyle.lineHeight,
            minWidth: 333,
            textAlign: 'center',
          }),
    }

    const inputStyle = {
      ...commonInputStyle,
      height: this.props.small ? 18 : 28,
      maxWidth: 460,
    }

    const textareaStyle = {
      ...commonInputStyle,
      height: 'initial',
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      paddingBottom: 0,
      paddingTop: 0,
      resize: 'none',
      width: '100%',
      wrap: 'off',
      ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : {overflowY: 'hidden'}),
    }

    const value = this._getValue()

    const floatingHintText =
      !!value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
        ? this.props.floatingHintTextOverride
        : this.props.hintText || ' ')

    const commonProps = {
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
      placeholder: this.props.hintText,
      readOnly: this.props.hasOwnProperty('editable') && !this.props.editable ? true : undefined,
      ref: this._setInputRef,
      ...(this.props.maxLength ? {maxLength: this.props.maxLength} : null),
    }

    if (!this.props.uncontrolled) {
      // @ts-ignore it's ok to add this
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
        color: globalColors.blue,
        fontSize: _bodySmallTextStyle.fontSize,
        lineHeight: `${_lineHeight}px`,
        marginRight: 8,
      },
      this.props.smallLabelStyle,
    ])

    const inputRealCSS = `::-webkit-input-placeholder { color: rgba(0,0,0,.4); }`

    return (
      <Box style={collapseStyles([containerStyle, this.props.style])}>
        <style>{inputRealCSS}</style>
        {!this.props.small && !this.props.hideLabel && (
          <Text center={true} type="BodySmallSemibold" style={_floatingStyle}>
            {floatingHintText}
          </Text>
        )}
        {!!this.props.small && !!this.props.smallLabel && !this.props.hideLabel && (
          <Text type="BodySmall" style={smallLabelStyle}>
            {this.props.smallLabel}
          </Text>
        )}
        {this.props.multiline ? (
          // @ts-ignore clash between our types and DOM types
          <textarea {...multilineProps} />
        ) : (
          // @ts-ignore clash between our types and DOM types
          <input {...singlelineProps} />
        )}
        {!!this.props.errorTextComponent && this.props.errorTextComponent}
        {!!this.props.errorText && !this.props.small && (
          <Text
            center={true}
            type="BodySmallError"
            style={collapseStyles([_errorStyle, this.props.errorStyle])}
          >
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
  marginTop: globalMargins.xtiny,
  width: '100%',
}

const _floatingStyle = platformStyles({
  isElectron: {
    color: globalColors.blue,
    display: 'block',
    minHeight: _bodySmallTextStyle.lineHeight,
  },
})

export default Input
