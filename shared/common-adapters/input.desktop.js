// @flow
import React, {Component} from 'react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles'
import {getStyle} from './text'

import type {Props} from './input'

type State = {
  value: ?string,
  focused: boolean,
}

class Input extends Component<void, Props, State> {
  state: State;
  _textField: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      value: props.value,
      focused: false,
    }
  }

  getValue (): ?string {
    return this.state.value
  }

  setValue (value: string) {
    this.setState({value})
  }

  clearValue () {
    this.onChange({target: {value: null}})
  }

  onChange (event: {target: {value: ?string}}) {
    this.setState({value: event.target.value})
    this.props.onChange && this.props.onChange(event)
    this.props.onChangeText && this.props.onChangeText(event.target.value || '')
  }

  focus () {
    this._textField && this._textField.focus()
  }

  select () {
    this._textField && this._textField.select()
  }

  blur () {
    this._textField && this._textField.blur()
  }

  _onKeyDown (e: SyntheticKeyboardEvent) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(e)
    }

    if (this.props.onEnterKeyDown && e.key === 'Enter') {
      this.props.onEnterKeyDown(e)
    }
  }

  render () {
    const style = this.props.small ? styles.containerSmall : styles.container
    const textStyle = this.props.small ? styles.inputSmall : styles.input
    const textHeight = this.props.small ? 32 : (this.props.floatingLabelText ? 79 : 50)
    const hintStyle = {bottom: this.props.small ? 11 : (this.props.multiline ? 16 : 14)}

    // HACK to make this cr*p line up. let's :fire: this whole file soon
    if (!this.props.small && !this.props.floatingLabelText && this.props.hintText) {
      // $FlowIssue this whole class needs to be cleaned up
      hintStyle.bottom = 'initial'
      // $FlowIssue this whole class needs to be cleaned up
      hintStyle.top = 7
    }
    if (!this.props.small && this.props.floatingLabelText && this.props.hintText) {
      // $FlowIssue this whole class needs to be cleaned up
      hintStyle.top = 32
    }

    // HACK: We can't reset the text area style, so we need to counteract it by moving the wrapper up
    const multilineStyleFix = {
      height: 'auto',
      position: 'relative',
      // Other HACK: having a floating label affects position, but only in multiline
      bottom: (this.props.floatingLabelText ? 30 : 6),
      // tweak distance between entered text and floating label to match single-line
      marginTop: 1,
      // tweak distance between entered text and underline to match single-line
      marginBottom: -2,
    }
    const inputStyle = this.props.multiline ? multilineStyleFix : {height: 'auto', top: 3}
    const alignStyle = this.props.style && this.props.style.textAlign ? {textAlign: this.props.style.textAlign} : {textAlign: 'center'}

    const passwordVisible = this.props.type === 'passwordVisible'
    const password = this.props.type === 'password'

    return (
      <div style={{...style, ...this.props.style}} onClick={() => { this._textField && this._textField.focus() }}>
        <TextField
          autoComplete={(passwordVisible || password) ? 'off' : undefined}
          autoFocus={this.props.autoFocus}
          errorStyle={{...styles.errorStyle, ...this.props.errorStyle}}
          errorText={this.props.errorText}
          floatingLabelFocusStyle={styles.floatingLabelFocusStyle}
          floatingLabelStyle={styles.floatingLabelStyle}
          floatingLabelText={this.props.small ? undefined : this.props.floatingLabelText}
          fullWidth={true}
          hintStyle={{...hintStyle, ...styles.hintStyle, ...this.props.hintStyle}}
          hintText={this.props.hintText}
          inputStyle={{...(this.props.small ? {} : {marginTop: 4}), ...inputStyle, ...alignStyle, ...this.props.inputStyle}}
          textareaStyle={{...alignStyle, overflow: 'overlay'}}
          name='name'
          multiLine={this.props.multiline}
          onBlur={() => this.setState({focused: false})}
          onChange={event => this.onChange(event)}
          onFocus={() => this.setState({focused: true})}
          onKeyDown={e => this._onKeyDown(e)}
          ref={textField => (this._textField = textField)}
          rows={this.props.rows}
          rowsMax={this.props.rowsMax}
          style={{...textStyle, height: textHeight, transition: 'none', ...globalStyles.flexBoxColumn, ...this.props.textStyle}}
          type={password ? 'password' : 'text'}
          underlineFocusStyle={{...styles.underlineFocusStyle, ...this.props.underlineStyle}}
          underlineShow={this.props.underlineShow}
          underlineStyle={{...styles.underlineStyle, ...this.props.underlineStyle}}
          value={this.state.value || ''}
          />
      </div>
    )
  }
}

export const styles = {
  container: {
    marginBottom: 8,
  },
  containerSmall: {
    margin: 0,
    marginTop: 2,
  },
  input: {
    ...getStyle('Header', 'Normal'),
    color: globalColors.black_10,
  },
  inputSmall: {
    ...getStyle('BodySmall', 'Normal'),
    color: globalColors.black_10,
    lineHeight: '16px',
  },
  underlineFocusStyle: {
    marginTop: 4,
    borderColor: globalColors.blue,
    borderBottom: 'solid 1px',
    transition: '',
  },
  underlineStyle: {
    borderColor: globalColors.black_10,
    bottom: 'auto',
    marginTop: 4,
  },
  errorStyle: {
    ...globalStyles.fontRegular,
    color: globalColors.red,
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: '17px',
    position: 'initial',
    marginTop: 4,
    paddingTop: 4,
  },
  hintStyle: {
    ...globalStyles.fontSemibold,
    color: globalColors.black_10,
    width: '100%',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  floatingLabelStyle: {
    ...globalStyles.fontSemibold,
    alignSelf: 'center',
    color: globalColors.black_10,
    fontSize: 16,
    lineHeight: '29px',
    position: 'inherit',
    top: 30,
    transform: 'scale(1) translate3d(0, 0, 0)',
    transition: 'color 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',
  },
  floatingLabelFocusStyle: {
    ...globalStyles.fontSemibold,
    alignSelf: 'center',
    color: globalColors.blue,
    fontSize: 11,
    lineHeight: '29px',
    position: 'inherit',
    transform: 'perspective(1px) scale(1) translate3d(2px, -26px, 0)',
    transformOrigin: 'center top',
  },
}

export default Input
