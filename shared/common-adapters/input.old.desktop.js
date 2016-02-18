import React, {Component} from 'react'
import {TextField} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import {styles as TextStyles} from './text'
import materialTheme from '../styles/material-theme.desktop'

// Floating label isn't very controllable, not going to make this pixel perfect

export default class Input extends Component {
  constructor (props) {
    super(props)

    this.state = {
      value: props.value
    }
  }
  getChildContext () {
    return {
      muiTheme: materialTheme
    }
  }

  getValue () {
    return this.state.value
  }

  clearValue () {
    return this.setState({value: null})
  }

  onChange (event) {
    this.setState({value: event.target.value})
  }

  blur () {
    this._textField && this._textField.blur()
  }

  render () {
    const style = this.props.small ? styles.containerSmall : styles.container
    const textStyle = this.props.small ? styles.inputSmall : styles.input
    return (
      <div style={{...style, ...this.props.style}}>
        <TextField
          ref={textField => (this._textField = textField)}
          fullWidth
          errorStyle={styles.errorStyle}
          style={textStyle}
          autoFocus={this.props.autoFocus}
          errorText={this.props.errorText}
          floatingLabelText={this.props.small ? undefined : this.props.floatingLabelText || this.props.hintText}
          floatingLabelStyle={styles.floatingLabelStyle}
          hintText={this.props.hintText}
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
    marginTop: -10
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
    fontSize: 13,
    lineHeight: '17px',
    top: -20,
    bottom: 'initial'
  },
  floatingLabelStyle: {
    ...globalStyles.fontRegular
  }
}

