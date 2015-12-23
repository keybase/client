import React, {Component} from '../base-react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'

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
        defaultValue={this.props.defaultValue}
        errorStyle={styles.inputError}
        errorText={this.props.errorText}
        floatingLabelStyle={styles.inputFloatingLabel}
        floatingLabelText={this.props.floatingLabelText || this.props.hintText}
        hintStyle={styles.inputHint}
        hintText={this.props.hintText}
        inputStyle={inputStyle}
        style={{...styles.input, ...this.props.style}}
        underlineStyle={styles.inputUnderline}
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
    height: 70
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

