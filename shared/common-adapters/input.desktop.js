// @flow
import React, {Component} from 'react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import {styles as TextStyles} from './text'
import materialTheme from '../styles/material-theme.desktop'

import InputOld from './input.old.desktop'

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
    if (!this.props.dz2) {
      return this.refs.inputOld && this.refs.inputOld.getValue()
    }
    return this.state.value
  }

  clearValue () {
    if (!this.props.dz2) {
      this.refs.inputOld && this.refs.inputOld.clearValue()
      return
    }
    this.setState({value: null})
  }

  onChange (event: {target: {value: ?string}}) {
    this.setState({value: event.target.value})
  }

  blur () {
    if (!this.props.dz2) {
      return this.refs.inputOld && this.refs.inputOld.blur()
    }

    this._textField && this._textField.blur()
  }

  render () {
    if (!this.props.dz2) {
      return <InputOld ref="inputOld" {...this.props}/>
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
    return (
      <div style={{...style, ...this.props.style}} onClick={() => { this._textField && this._textField.focus() }}>
        <TextField
          ref={textField => (this._textField = textField)}
          fullWidth
          inputStyle={inputStyle}
          underlineStyle={{bottom: 'auto'}}
          errorStyle={{...styles.errorStyle, ...this.props.errorStyle}}
          style={{...textStyle, ...globalStyles.flexBoxColumn}}
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          floatingLabelText={this.props.small ? undefined : this.props.floatingLabelText}
          floatingLabelStyle={{...styles.floatingLabelStyle, ...(this.state.focused ? {color: globalColorsDZ2.blue} : {})}}
          onFocus={() => this.setState({focused: true})}
          onBlur={() => this.setState({focused: false})}
          hintText={this.props.hintText}
          hintStyle={{...styles.hintStyle, ...(this.props.multiLine ? {textAlign: 'center'} : {top: 3, bottom: 'auto'})}}
          multiLine={this.props.multiLine}
          onChange={event => {
            this.onChange(event)
            this.props.onChange && this.props.onChange(event)
          }}
          onEnterKeyDown={this.props.onEnterKeyDown}
          underlineFocusStyle={styles.underlineFocusStyle}
          rows={this.props.rows}
          rowsMax={this.props.rowsMax}
          type={this.props.type}
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
    ...TextStyles.textBody
  },
  inputSmall: {
    ...TextStyles.textBody,
    ...TextStyles.textSmallMixin,
    height: 40,
    lineHeight: '11px'
  },
  underlineFocusStyle: {
    borderColor: globalColorsDZ2.blue,
    transition: ''
  },
  errorStyle: {
    ...globalStyles.DZ2.fontRegular,
    color: globalColors.highRiskWarning,
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: '17px',
    position: 'initial',
    marginTop: 4
  },
  hintStyle: {
    ...globalStyles.DZ2.fontRegular
  },
  floatingLabelStyle: {
    ...globalStyles.DZ2.fontRegular,
    alignSelf: 'center',
    position: 'inherit',
    top: 34
  }
}

