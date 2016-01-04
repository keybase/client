import React, {Component} from '../base-react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import {styles as TextStyles} from './text'

// Floating label isn't very controllable, not going to make this pixel perfect

export default class Input extends Component {
  render () {
    let inputStyle = null
    if (this.props.multiLine) {
      inputStyle = this.props.errorText ? styles.inputMultiWithError : styles.inputMultiNormal
    } else {
      inputStyle = this.props.errorText ? styles.inputWithError : styles.inputNormal
    }

    return (
      <TextField
        autoFocus={this.props.autoFocus}
        errorStyle={styles.inputError}
        errorText={this.props.errorText}
        floatingLabelStyle={styles.inputFloatingLabel}
        floatingLabelText={this.props.floatingLabelText || this.props.hintText}
        hintStyle={styles.inputHint}
        hintText={this.props.hintText}
        inputStyle={inputStyle}
        multiLine={this.props.multiLine}
        onChange={this.props.onChange}
        onEnterKeyDown={this.props.onEnterKeyDown}
        rows={this.props.rows}
        rowsMax={this.props.rowsMax}
        style={{...styles.input, ...this.props.style}}
        type={this.props.type}
        underlineStyle={styles.inputUnderline}
        value={this.props.value}
        />
    )
  }
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
  type: React.PropTypes.string,
  value: React.PropTypes.string
}

const inputCommon = {
  ...globalStyles.fontRegular,
  border: `solid ${globalColors.grey3} 1px`,
  paddingLeft: 9,
  paddingRight: 9
}

const inputMultiCommon = {
  ...inputCommon,
  backgroundColor: globalColors.grey4
}

export const styles = {
  input: {
    ...TextStyles.textBody,
    height: 70,
  },
  inputNormal: {
    ...inputCommon,
    height: 30
  },
  inputWithError: {
    ...inputCommon,
    height: 30,
    borderColor: globalColors.highRiskWarning
  },
  inputMultiNormal: {
    ...inputMultiCommon
  },
  inputMultiWithError: {
    ...inputMultiCommon,
    borderColor: globalColors.highRiskWarning
  },
  inputUnderline: {
    display: 'none'
  },
  inputError: {
    ...globalStyles.fontRegular,
    fontSize: 13,
    lineHeight: '17px',
    paddingTop: 5
  },
  inputHint: {
    ...globalStyles.fontRegular,
    left: 0
  },
  inputFloatingLabel: {
    ...globalStyles.fontRegular,
    left: 9,
    top: 19
  }
}

