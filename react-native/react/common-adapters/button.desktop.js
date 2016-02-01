/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './button'

export default class Button extends Component {
  props: Props;

  render () {
    const rootStyle = this.props.primary ? styles.buttonPrimary : styles.buttonSeconary
    const smallStyle = this.props.small ? styles.buttonSmall : {}
    const smallLabelStyle = this.props.small ? styles.buttonSmallLabel : {}
    const moreStyle = this.props.more ? styles.buttonMore : {}
    const moreLabelStyle = this.props.more ? styles.buttonMoreLabel : {}

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...smallStyle, ...moreStyle, ...this.props.style}}
        labelStyle={{...styles.buttonLabel, ...smallLabelStyle, ...moreLabelStyle}}
        label={this.props.label || this.props.more && '•••'}
        primary={this.props.primary} />
    )
  }
}

Button.propTypes = {
  onClick: React.PropTypes.func.isRequired,
  label: React.PropTypes.string,
  style: React.PropTypes.object,
  primary: React.PropTypes.bool,
  small: React.PropTypes.bool,
  more: React.PropTypes.bool
}

const buttonCommon = {
  ...globalStyles.fontRegular,
  borderRadius: 61,
  color: globalColors.white,
  fontSize: 18,
  paddingTop: 4,
  paddingBottom: 4,
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

export const styles = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColors.green
  },
  buttonSeconary: {
    ...buttonCommon,
    backgroundColor: globalColors.lightBlue,
    marginRight: 10
  },
  buttonSmall: {
    fontSize: 13,
    paddingTop: 3,
    paddingBottom: 3,
    lineHeight: '18px'
  },
  buttonLabel: {
    paddingLeft: 24,
    paddingRight: 24
  },
  buttonSmallLabel: {
    paddingLeft: 10,
    paddingRight: 10
  },
  buttonMore: {
    ...buttonCommon,
    backgroundColor: globalColors.grey3,
    paddingLeft: 2,
    paddingRight: 2,
    paddingTop: 2,
    paddingBottom: 2,
    height: 12,
    lineHeight: '2px'
  },
  buttonMoreLabel: {
    paddingLeft: 3,
    paddingRight: 3,
    paddingTop: 3,
    paddingBottom: 3
  }
}

