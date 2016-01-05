/* @flow */

import React, {Component} from '../base-react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './button'

export default class Button extends Component {
  props: Props;

  render () {
    const rootStyle = this.props.primary ? styles.buttonPrimary : styles.buttonSeconary
    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...this.props.style}}
        labelStyle={styles.buttonLabel}
        label={this.props.label}
        primary={this.props.primary} />
    )
  }
}

Button.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  label: React.PropTypes.string,
  style: React.PropTypes.object,
  primary: React.PropTypes.bool
}

const buttonCommon = {
  ...globalStyles.fontRegular,
  borderRadius: 61,
  color: globalColors.white,
  fontSize: 18,
  height: 32,
  lineHeight: '24px',
  textTransform: 'none'
}

export const styles = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColors.green
  },
  buttonSeconary: {
    ...buttonCommon,
    backgroundColor: globalColors.blue,
    marginRight: 10
  },
  buttonLabel: {
    paddingLeft: 24,
    paddingRight: 24
  }
}

