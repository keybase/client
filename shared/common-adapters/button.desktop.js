/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2, fontDZ2} from '../styles/style-guide'
import type {Props} from './button'
import flags from '../util/feature-flags'

export default class Button extends Component {
  props: Props;

  render1 () {
    const rootStyle = this.props.primary ? styles1.buttonPrimary : styles1.buttonSecondary
    const smallStyle = this.props.small ? styles1.buttonSmall : {}
    const smallLabelStyle = this.props.small ? styles1.buttonSmallLabel : {}
    const moreStyle = this.props.more ? styles1.buttonMore : {}
    const moreLabelStyle = this.props.more ? styles1.buttonMoreLabel : {}

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...smallStyle, ...moreStyle, ...this.props.style}}
        labelStyle={{...styles1.buttonLabel, ...smallLabelStyle, ...moreLabelStyle}}
        label={this.props.label || this.props.more && '•••'}
        primary={this.props.primary} />
    )
  }

  render () {
    if (!flags.tracker2) {
      return this.render1()
    }

    let backgroundColorStyle = {}
    let labelStyle = {}
    let widthStyle = {}
    let smallStyle = {}
    console.log('in render')
    console.log(this.props)
    if (this.props.primary) {
      console.log('a')
      backgroundColorStyle = styles2.buttonPrimary
    } else if (this.props.follow) {
      backgroundColorStyle = styles2.buttonFollow
    } else if (this.props.small) {
      smallStyle = styles2.buttonSmall
    } else {
      backgroundColorStyle = styles2.buttonSecondary
      labelStyle = {
        ...labelStyle,
        color: globalColorsDZ2.black75
      }
    }

    console.log(backgroundColorStyle)
    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...backgroundColorStyle,  ...this.props.style}}
        labelStyle={{...styles2.buttonLabel, ...labelStyle}}
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
  secondary: React.PropTypes.bool,
  follow: React.PropTypes.bool,
  small: React.PropTypes.bool,
  more: React.PropTypes.bool
}

const buttonCommon1 = {
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

const buttonCommon2 = {
  ...globalStyles.DZ2.fontSemibold,
  color: globalColorsDZ2.white,
  borderRadius: 55,
  fontSize: 16,
  height: '32px',
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

export const styles2 = {
  buttonPrimary: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.blue,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonSecondary: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.lightGrey2,
    disabledOpacity: 0.3,
    marginRight: 10
  },
  buttonDanger: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.red1,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonFollow: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.green1,
    disabledOpacity: 0.3,
    marginRight: 10
  },
  buttonSmall: {
    paddingTop: 20,
    paddingBottom: 20,
    lineHeight: '28px'
  },
  buttonLabel: {
    paddingLeft: 25,
    paddingRight: 25
  },
  buttonSmallLabel: {
    paddingLeft: 20,
    paddingRight: 20
  }
}

export const styles1 = {
  buttonPrimary: {
    ...buttonCommon1,
    backgroundColor: globalColors.green
  },
  buttonSecondary: {
    ...buttonCommon1,
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
    ...buttonCommon1,
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
