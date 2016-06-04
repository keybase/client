// @flow
import React, {Component} from 'react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import {styles as TextStyles, specialStyles} from './text'
import materialTheme from '../styles/material-theme.desktop'
import MultiLineInput from './multi-line-input.desktop'

import type {Props} from './input'

export default class Input extends Component {
  props: Props;
  state: {value: ?string, focused: boolean};
  _textField: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      value: props.value,
      focused: false
    }
  }
  getChildContext (): Object {
    return {
      muiTheme: materialTheme
    }
  }

  getValue (): ?string {
    return this.state.value
  }

  clearValue () {
    this.setState({value: null})
  }

  onChange (event: {target: {value: ?string}}) {
    this.setState({value: event.target.value})
    this.props.onChange && this.props.onChange(event)
    this.props.onChangeText && this.props.onChangeText(event.target.value || '')
  }

  blur () {
    this._textField && this._textField.blur()
  }

  render () {
    if (this.props.multiLine) {
      return (
        <MultiLineInput
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          onChange={event => this.onChange(event)}
          onEnterKeyDown={this.props.onEnterKeyDown}
          hintText={this.props.hintText}
          style={this.props.style} />
      )
    }

    const style = this.props.small ? styles.containerSmall : styles.container
    const textStyle = this.props.small ? styles.inputSmall : styles.input

    // HACK: We can't reset the text area style, so we need to counteract it by moving the wrapper up
    const multiLineStyleFix = {
      height: 'auto', position: 'relative',
      // Other HACK: having a floating label affects position, but only in multiline
      bottom: (this.props.floatingLabelText ? 30 : 5),
      marginTop: 6
    }
    const inputStyle = this.props.multiLine ? multiLineStyleFix : {height: 'auto'}
    const alignStyle = this.props.style && this.props.style.textAlign ? {textAlign: this.props.style.textAlign} : {textAlign: 'center'}

    const passwordVisible = this.props.type === 'passwordVisible'
    const password = this.props.type === 'password'

    return (
      <div style={{...style, ...this.props.style}} onClick={() => { this._textField && this._textField.focus() }}>
        <TextField
          ref={textField => (this._textField = textField)}
          onKeyDown={this.props.onKeyDown}
          fullWidth
          textAlign='center'
          inputStyle={{...inputStyle, ...alignStyle, ...this.props.inputStyle}}
          underlineStyle={{borderColor: globalColors.black_10, bottom: 'auto', ...this.props.underlineStyle}}
          errorStyle={{...styles.errorStyle, ...this.props.errorStyle}}
          style={{...textStyle, ...globalStyles.flexBoxColumn}}
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          floatingLabelText={this.props.small ? undefined : this.props.floatingLabelText}
          floatingLabelStyle={{...styles.floatingLabelStyle, ...(this.state.value || this.state.focused ? {color: globalColors.blue, transform: 'perspective(1px) scale(0.64) translate3d(2px, -28px, 0)', transformOrigin: 'center top'} : {transform: 'scale(1) translate3d(0, 0, 0)'})}}
          onFocus={() => this.setState({focused: true})}
          onBlur={() => this.setState({focused: false})}
          hintText={this.props.hintText}
          hintStyle={{...styles.hintStyle, ...(this.props.multiLine ? {textAlign: 'center'} : {top: 3, bottom: 'auto'}), ...this.props.hintStyle}}
          multiLine={this.props.multiLine}
          onChange={event => this.onChange(event)}
          onEnterKeyDown={this.props.onEnterKeyDown}
          underlineFocusStyle={{...styles.underlineFocusStyle, ...this.props.underlineStyle}}
          rows={this.props.rows}
          rowsMax={this.props.rowsMax}
          autoComplete={(passwordVisible || password) ? 'off' : undefined}
          type={password ? 'password' : 'text'}
          value={this.state.value}
          />
      </div>
    )
  }
}

Input.childContextTypes = {
  muiTheme: React.PropTypes.object
}

export const styles = {
  container: {
    marginBottom: 8
  },
  containerSmall: {
    margin: 0,
    marginTop: 2
  },
  input: {
    ...specialStyles.textInput,
    height: 80
  },
  inputSmall: {
    ...TextStyles.textBody,
    ...TextStyles.textSmallMixin,
    height: 40,
    lineHeight: '11px'
  },
  underlineFocusStyle: {
    borderColor: globalColors.blue,
    borderBottom: 'solid 1px',
    transition: ''
  },
  errorStyle: {
    ...globalStyles.fontRegular,
    color: globalColors.red,
    alignSelf: 'center',
    fontSize: 14,
    lineHeight: '17px',
    position: 'initial',
    marginTop: 4,
    paddingTop: 4
  },
  hintStyle: {
    ...globalStyles.fontSemibold,
    color: globalColors.black_10,
    width: '100%',
    textAlign: 'center',
    marginTop: -3
  },
  floatingLabelStyle: {
    ...globalStyles.fontSemibold,
    color: globalColors.black_10,
    alignSelf: 'center',
    position: 'inherit',
    top: 34,
    transition: 'color 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms'
  }
}
