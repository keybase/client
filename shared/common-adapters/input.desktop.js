// @flow
import React, {Component} from 'react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import {styles as TextStyles} from './text'
import materialTheme from '../styles/material-theme.desktop'

import type {Props} from './input'

export default class Input extends Component {
  props: Props;
  state: {value: ?string};
  _textField: any;

  constructor (props: Props) {
    super(props)

    this.state = {
      value: props.value
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
  }

  blur () {
    this._textField && this._textField.blur()
  }

  render () {
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
      <div style={{...style, ...this.props.style}}>
        <TextField
          ref={textField => this._textField = textField}
          fullWidth
          inputStyle={inputStyle}
          underlineStyle={{bottom: 'auto'}}
          errorStyle={{...styles.errorStyle, ...this.props.errorStyle}}
          style={{...textStyle, ...globalStyles.flexBoxColumn}}
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          floatingLabelText={this.props.small ? undefined : this.props.floatingLabelText || this.props.hintText}
          floatingLabelStyle={styles.floatingLabelStyle}
          hintText={this.props.hintText}
          hintStyle={{top: 3, bottom: 'auto'}}
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

Input.propTypes = {
  autoFocus: React.PropTypes.bool,
  errorText: React.PropTypes.string,
  floatingLabelText: React.PropTypes.string,
  hintText: React.PropTypes.string,
  multiLine: React.PropTypes.bool,
  onChange: React.PropTypes.func,
  onEnterKeyDown: React.PropTypes.func,
  rows: React.PropTypes.number,
  rowsMax: React.PropTypes.number,
  style: React.PropTypes.object,
  type: React.PropTypes.oneOf(['password', 'text']),
  value: React.PropTypes.string,
  small: React.PropTypes.bool
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
    borderColor: globalColors.blue,
    transition: ''
  },
  errorStyle: {
    ...globalStyles.fontRegular,
    color: globalColors.highRiskWarning,
    alignSelf: 'center',
    fontSize: 13,
    lineHeight: '17px',
    position: 'initial',
    marginTop: 4
  },
  floatingLabelStyle: {
    ...globalStyles.fontRegular,
    alignSelf: 'center',
    position: 'inherit',
    top: 34
  }
}

