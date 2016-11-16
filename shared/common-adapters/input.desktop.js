// @flow
import React, {Component} from 'react'
import {findDOMNode} from 'react-dom'
import Box from './box'
import Text, {getStyle as getTextStyle} from './text.desktop'
import {globalStyles, globalColors} from '../styles'

import type {Props} from './input'

type State = {
  value: string,
  focused: boolean,
}

class Input extends Component<void, Props, State> {
  state: State;
  _input: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      value: props.value || '',
      focused: false,
    }
  }

  componentDidMount () {
    this._autoResize()
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.hasOwnProperty('value')) {
      this.setState({value: nextProps.value || ''})
      this._autoResize()
    }
  }

  getValue (): string {
    return this.state.value || ''
  }

  setValue (value: string) {
    this.setState({value: value || ''})
  }

  clearValue () {
    this._onChange({target: {value: ''}})
  }

  _onChange = (event: {target: {value: ?string}}) => {
    this.setState({value: event.target.value || ''})
    this._autoResize()

    this.props.onChangeText && this.props.onChangeText(event.target.value || '')
  }

  _autoResize () {
    if (!this.props.multiline) {
      return
    }

    const node = this._inputNode()
    if (!node) {
      return
    }

    node.style.height = 'auto'
    node.style.height = `${node.scrollHeight}px`
  }

  _inputNode () {
    return findDOMNode(this._input)
  }

  focus () {
    this._input && this._inputNode().focus()
  }

  select () {
    this._input && this._inputNode().select()
  }

  blur () {
    this._input && this._inputNode().blur()
  }

  _onKeyDown = (e: SyntheticKeyboardEvent) => {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e)
    }

    if (this.props.onEnterKeyDown && e.key === 'Enter') {
      this.props.onEnterKeyDown(e)
    }
  }

  _onFocus = () => {
    this.setState({focused: true})
  }

  _onBlur = () => {
    this.setState({focused: false})
  }

  _underlineColor () {
    if (this.props.hideUnderline) {
      return globalColors.transparent
    }

    if (this.props.errorText && this.props.errorText.length) {
      return globalColors.red
    }

    return this.state.focused ? globalColors.blue : globalColors.black_10
  }

  _rowsToHeight (rows) {
    return rows * _lineHeight +
      1 // border
  }

  _containerStyle (underlineColor) {
    return this.props.small
    ? {
      ...globalStyles.flexBoxRow,
      borderBottom: `1px solid ${underlineColor}`,
      flex: 1,
    }
    : {
      ...globalStyles.flexBoxColumn,
      maxWidth: 460,
      width: '100%',
    }
  }

  _propTypeToSingleLineType () {
    switch (this.props.type) {
      case 'password':
        return 'password'
      default:
        return 'text'
    }
  }

  render () {
    const underlineColor = this._underlineColor()
    const defaultRowsToShow = Math.min(2, this.props.rowsMax || 2)
    const containerStyle = this._containerStyle(underlineColor)

    const commonInputStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      lineHeight: `${_lineHeight}px`,
      backgroundColor: globalColors.transparent,
      flex: 1,
      border: 'none',
      outlineWidth: 0,
      ...(this.props.small
      ? {textAlign: 'left'}
      : {
        textAlign: 'center',
        minWidth: 333,
        borderBottom: `1px solid ${underlineColor}`,
      }),
    }

    const inputStyle = {
      ...commonInputStyle,
      height: 28,
    }

    const textareaStyle = {
      ...commonInputStyle,
      height: 'initial',
      resize: 'none',
      wrap: 'off',
      paddingTop: 0,
      paddingBottom: 0,
      minHeight: this._rowsToHeight(this.props.rowsMin || defaultRowsToShow),
      ...(this.props.rowsMax
        ? {maxHeight: this._rowsToHeight(this.props.rowsMax)}
        : {overflowY: 'hidden'}),
    }

    const floatingHintText = !!this.state.value.length &&
      (this.props.hasOwnProperty('floatingHintTextOverride')
       ? this.props.floatingHintTextOverride
       : this.props.hintText || ' ')

    const commonProps = {
      autoFocus: this.props.autoFocus,
      onBlur: this._onBlur,
      onChange: this._onChange,
      onFocus: this._onFocus,
      onKeyDown: this._onKeyDown,
      placeholder: this.props.hintText,
      ref: r => { this._input = r },
      value: this.state.value,
    }

    const singlelineProps = {
      ...commonProps,
      style: {...inputStyle, ...this.props.inputStyle},
      type: this._propTypeToSingleLineType(),
    }

    const multilineProps = {
      ...commonProps,
      style: {...textareaStyle, ...this.props.inputStyle},
    }

    const smallLabelStyle = {
      ...globalStyles.fontSemibold,
      fontSize: _headerTextStyle.fontSize,
      lineHeight: `${_lineHeight}px`,
      marginRight: 8,
      color: globalColors.blue,
      ...this.props.smallLabelStyle,
    }

    return (
      <Box style={{...containerStyle, ...this.props.style}}>
        {!this.props.small && <Text type='BodySmall' style={_floatingStyle}>{floatingHintText}</Text>}
        {!!this.props.small && !!this.props.smallLabel && <Text type='BodySmall' style={smallLabelStyle}>{this.props.smallLabel}</Text>}
        {this.props.multiline
          ? <textarea {...multilineProps} />
          : <input {...singlelineProps} />}
        {!!this.props.errorText && !this.props.small && <Text type='BodyError' style={{..._errorStyle, ...this.props.errorStyle}}>{this.props.errorText}</Text>}
      </Box>
    )
  }
}

const _lineHeight = 28
const _headerTextStyle = getTextStyle('Header')
const _bodySmallTextStyle = getTextStyle('BodySmall')

const _errorStyle = {
  textAlign: 'center',
  width: '100%',
}

const _floatingStyle = {
  textAlign: 'center',
  minHeight: _bodySmallTextStyle.lineHeight,
  color: globalColors.blue,
  display: 'block',
  marginBottom: 9,
}

export default Input
