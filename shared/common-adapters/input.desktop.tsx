import * as React from 'react'
import * as Styles from '../styles'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.desktop'

import {Props, Selection, TextInfo} from './input'
import {checkTextInfo} from './input.shared'

type State = {
  focused: boolean
}

class Input extends React.PureComponent<Props, State> {
  _input: HTMLTextAreaElement | HTMLInputElement | null = null
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

  componentDidUpdate = (prevProps: Props) => {
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
            const newText = text.slice(0, selection.start || 0) + '\n' + text.slice(selection.end || 0)
            const pos = (selection.start || 0) + 1
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
      return Styles.globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return Styles.globalColors.red
    }

    return this.state.focused ? Styles.globalColors.blue : Styles.globalColors.black_10
  }

  _rowsToHeight = rows => {
    return rows * _lineHeight + 1 // border
  }

  _containerStyle = () => {
    return this.props.small
      ? {
          ...Styles.globalStyles.flexBoxRow,
          width: '100%',
        }
      : {
          ...Styles.globalStyles.flexBoxColumn,
          alignItems: 'center',
          marginBottom: Styles.globalMargins.small,
          marginTop: Styles.globalMargins.small,
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
    const containerStyle = this._containerStyle()

    const inputStyle = Styles.collapseStyles([
      styles.commonInput,
      this.props.small ? styles.commonInputSmall : styles.commonInputRegular,
      {
        borderBottom: `1px solid ${underlineColor}`,
        height: this.props.small ? 18 : 28,
        maxWidth: 460,
      },
    ])

    const textareaStyle = Styles.collapseStyles([
      styles.commonInput,
      this.props.small
        ? styles.commonInputSmall
        : {...styles.commonInputRegular, borderBottom: `1px solid ${underlineColor}`},
      {
        height: 'initial',
        minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
        paddingBottom: 0,
        paddingTop: 0,
        resize: 'none',
        width: '100%',
        wrap: 'off',
        ...(this.props.rowsMax ? {maxHeight: this._rowsToHeight(this.props.rowsMax)} : {overflowY: 'hidden'}),
      },
    ])

    const value = this._getValue()

    const floatingHintText =
      !!value.length &&
      (Object.prototype.hasOwnProperty.call(this.props, 'floatingHintTextOverride')
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
      readOnly:
        Object.prototype.hasOwnProperty.call(this.props, 'editable') && !this.props.editable
          ? true
          : undefined,
      ref: this._setInputRef,
      ...(this.props.maxLength ? {maxLength: this.props.maxLength} : null),
    }

    if (!this.props.uncontrolled) {
      // @ts-ignore it's ok to add this
      commonProps.value = value
    }

    const singlelineProps = {
      ...commonProps,
      style: Styles.collapseStyles([inputStyle, this.props.inputStyle]),
      type: this._propTypeToSingleLineType(),
    }

    const multilineProps = {
      ...commonProps,
      rows: this.props.rowsMin || defaultRowsToShow,
      style: Styles.collapseStyles([textareaStyle, this.props.inputStyle]),
    }

    return (
      <Box style={Styles.collapseStyles([containerStyle, this.props.style])}>
        {!this.props.small && !this.props.hideLabel && (
          <Text center={true} type="BodySmallSemibold" style={styles.floating}>
            {floatingHintText}
          </Text>
        )}
        {!!this.props.small && !!this.props.smallLabel && !this.props.hideLabel && (
          <Text
            type="BodySmall"
            style={Styles.collapseStyles([styles.smallLabel, this.props.smallLabelStyle])}
          >
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
            style={Styles.collapseStyles([styles.error, this.props.errorStyle])}
          >
            {this.props.errorText}
          </Text>
        )}
      </Box>
    )
  }
}

const _lineHeight = 20
const _headerTextStyle: any = getTextStyle('Header')
const _bodyTextStyle: any = getTextStyle('Body')
const _bodySmallTextStyle: any = getTextStyle('BodySmall')

const styles = Styles.styleSheetCreate(() => ({
  commonInput: Styles.collapseStyles([
    Styles.globalStyles.fontSemibold,
    {
      backgroundColor: Styles.globalColors.transparent,
      border: 'none',
      color: Styles.globalColors.black,
      flex: 1,
      outlineWidth: 0,
    },
  ]),
  commonInputRegular: {
    fontSize: _headerTextStyle.fontSize,
    fontWeight: _headerTextStyle.fontWeight,
    lineHeight: _headerTextStyle.lineHeight,
    minWidth: 333,
    textAlign: 'center',
  },
  commonInputSmall: {
    fontSize: _bodyTextStyle.fontSize,
    fontWeight: _bodyTextStyle.fontWeight,
    lineHeight: _bodyTextStyle.lineHeight,
    textAlign: 'left',
  },
  error: {
    marginTop: Styles.globalMargins.xtiny,
    width: '100%',
  },
  floating: Styles.platformStyles({
    isElectron: {
      color: Styles.globalColors.blueDark,
      display: 'block',
      minHeight: _bodySmallTextStyle.lineHeight,
    },
  }),
  smallLabel: Styles.collapseStyles([
    Styles.globalStyles.fontSemibold,
    {
      color: Styles.globalColors.blueDark,
      fontSize: _bodySmallTextStyle.fontSize,
      lineHeight: `${_lineHeight}px`,
      marginRight: 8,
    },
  ]),
}))
export default Input
