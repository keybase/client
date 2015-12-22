import React, {Component} from '../base-react'
import {TextField} from 'material-ui'
import {globalStyles} from '../styles/style-guide'

// Floating label isn't very controllable, not going to make this pixel perfect

export default class Input extends Component {
  render () {
    let inputStyle = null
    if (this.props.multiLine) {
      inputStyle = this.props.errorText ? globalStyles.inputMultiWithError : globalStyles.inputMultiNormal
    } else {
      inputStyle = this.props.errorText ? globalStyles.inputWithError : globalStyles.inputNormal
    }

    return (
      <TextField
        defaultValue={this.props.defaultValue}
        errorStyle={globalStyles.inputError}
        errorText={this.props.errorText}
        floatingLabelStyle={globalStyles.inputFloatingLabel}
        floatingLabelText={this.props.floatingLabelText || this.props.hintText}
        hintStyle={globalStyles.inputHint}
        hintText={this.props.hintText}
        inputStyle={inputStyle}
        style={{...globalStyles.input, ...this.props.style}}
        underlineStyle={globalStyles.inputUnderline}
        multiLine={this.props.multiLine}
        rows={this.props.rows}
        rowsMax={this.props.rowsMax}
        />
    )
  }
}

Input.propTypes = {
  defaultValue: React.PropTypes.string,
  errorText: React.PropTypes.string,
  floatingLabelText: React.PropTypes.string,
  hintText: React.PropTypes.string,
  multiLine: React.PropTypes.bool,
  rows: React.PropTypes.number,
  rowsMax: React.PropTypes.number,
  style: React.PropTypes.object
}
