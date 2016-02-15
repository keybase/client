/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './button'
import flags from '../util/feature-flags'

export default class Button extends Component {
  props: Props;

  render () {
    let styles
    if (flags.tracker2) {
      styles = styles2
    } else {
      styles = styles1
    }

    const rootStyle = (this.props.follow || this.props.primary) ? styles.buttonPrimary : styles.buttonSecondary
    const smallStyle = this.props.small ? styles.buttonSmall : {}
    const followStyle = this.props.follow ? styles2.buttonFollow : {}
    const smallLabelStyle = this.props.small ? styles.buttonSmallLabel : {}
    const moreStyle = this.props.more ? styles.buttonMore : {}
    const moreLabelStyle = this.props.more ? styles.buttonMoreLabel : {}

    // FIXME: A better way?
    const textForeground = flags.tracker2 && rootStyle.backgroundColor == globalColorsDZ2.backgroundGrey ?
      { color: globalColorsDZ2.black40 } :
      { color: globalColorsDZ2.white100 }

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...smallStyle, ...moreStyle, ...followStyle, ...this.props.style}}
        labelStyle={{...styles.buttonLabel, ...smallLabelStyle, ...moreLabelStyle, ...textForeground}}
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

export const styles2 = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColorsDZ2.blue,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonSecondary: {
    ...buttonCommon,
    backgroundColor: globalColorsDZ2.backgroundGrey,
    disabledOpacity: 0.3,
    marginRight: 10
  },
  buttonDanger: {
    ...buttonCommon,
    backgroundColor: globalColorsDZ2.red1,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonFollow: {
    ...buttonCommon,
    backgroundColor: globalColorsDZ2.green1,
    disabledOpacity: 0.3,
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
export const styles1 = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColors.green
  },
  buttonSecondary: {
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
