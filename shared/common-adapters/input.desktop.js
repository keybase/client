// @flow
import MultiLineInput from './multi-line-input.desktop'
import React, {Component} from 'react'
import type {Props} from './input'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles'
import {styles as TextStyles, specialStyles} from './text'

type State = {
  value: ?string,
  focused: boolean
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
    if (this.props.multiLine) {
      return (
        <MultiLineInput
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          errorStyle={this.props.errorStyle}
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
      height: 'auto',
      position: 'relative',
      // Other HACK: having a floating label affects position, but only in multiline
      bottom: (this.props.floatingLabelText ? 30 : 5),
      marginTop: 6,
    }
    const inputStyle = this.props.multiLine ? multiLineStyleFix : {height: 'auto'}
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
          hintStyle={{...styles.hintStyle, ...(this.props.multiLine ? {textAlign: 'center'} : {top: 3, bottom: 'auto'}), ...this.props.hintStyle}}
          hintText={this.props.hintText}
          inputStyle={{...(this.props.small ? {} : {marginTop: 6}), ...inputStyle, ...alignStyle, ...this.props.inputStyle}}
          multiLine={this.props.multiLine}
          name='name'
          onBlur={() => this.setState({focused: false})}
          onChange={event => this.onChange(event)}
          onFocus={() => this.setState({focused: true})}
          onKeyDown={e => this._onKeyDown(e)}
          ref={textField => (this._textField = textField)}
          rows={this.props.rows}
          rowsMax={this.props.rowsMax}
          style={{...textStyle, ...globalStyles.flexBoxColumn, ...this.props.textStyle}}
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
    ...specialStyles.textInput,
    height: 80,
  },
  inputSmall: {
    ...TextStyles.textBody,
    ...TextStyles.textSmallMixin,
    height: 40,
    lineHeight: '11px',
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
    fontSize: 14,
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
    marginTop: -3,
  },
  floatingLabelStyle: {
    ...globalStyles.fontSemibold,
    alignSelf: 'center',
    color: globalColors.black_10,
    fontSize: 24,
    lineHeight: '29px',
    position: 'inherit',
    transform: 'scale(1) translate3d(0, 0, 0)',
    transition: 'color 450ms cubic-bezier(0.23, 1, 0.32, 1) 0ms',
  },
  floatingLabelFocusStyle: {
    ...globalStyles.fontSemibold,
    alignSelf: 'center',
    color: globalColors.blue,
    fontSize: 14,
    lineHeight: '29px',
    position: 'inherit',
    transform: 'perspective(1px) scale(1) translate3d(2px, -29px, 0)',
    transformOrigin: 'center top',
  },
}

export default Input
