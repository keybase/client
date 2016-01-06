import React, {Component} from '../base-react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import {styles as TextStyles} from './text'
import materialTheme from '../styles/material-theme.desktop'

// Floating label isn't very controllable, not going to make this pixel perfect

export default class Input extends Component {
  getChildContext () {
    return {
      muiTheme: materialTheme
    }
  }

  render () {
    return (
      <div style={{...styles.container, ...this.props.style}}>
        <TextField
          fullWidth
          errorStyle={styles.errorStyle}
          style={styles.input}
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          floatingLabelText={this.props.floatingLabelText || this.props.hintText}
          floatingLabelStyle={styles.floatingLabelStyle}
          hintText={this.props.hintText}
          multiLine={this.props.multiLine}
          onChange={this.props.onChange}
          onEnterKeyDown={this.props.onEnterKeyDown}
          underlineFocusStyle={styles.underlineFocusStyle}
          rows={this.props.rows}
          rowsMax={this.props.rowsMax}
          type={this.props.type}
          value={this.props.value}
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
  type: React.PropTypes.string,
  value: React.PropTypes.string
}

export const styles = {
  container: {
    marginBottom: 8
  },
  input: {
    ...TextStyles.textBody
  },
  underlineFocusStyle: {
    borderColor: globalColors.blue,
    transition: ''
  },
  errorStyle: {
    ...globalStyles.fontRegular,
    color: globalColors.highRiskWarning,
    fontSize: 13,
    lineHeight: '17px',
    top: -20,
    bottom: 'initial'
  },
  floatingLabelStyle: {
    ...globalStyles.fontRegular
  }
}

