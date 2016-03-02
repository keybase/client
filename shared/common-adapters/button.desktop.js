/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './button'

export default class Button extends Component {
  props: Props;

  _styles (type: Props.type): Object {
    let backgroundStyle = {}
    let labelStyle = {}

    switch (this.props.type) {
      case 'Primary':
        backgroundStyle = {
          ...styles.buttonPrimary,
          opacity: this.props.disabled ? styles.buttonPrimary.disabledOpacity : 1
        }
        break
      case 'Follow':
        backgroundStyle = {
          ...styles.buttonFollow,
          opacity: this.props.disabled ? styles.buttonFollow.disabledOpacity : 1
        }
        break
      case 'Following':
        backgroundStyle = {
          ...styles.buttonFollowing,
          opacity: this.props.disabled ? styles.buttonFollowing.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColorsDZ2.green
        }
        break
      case 'Unfollow':
        backgroundStyle = {
          ...styles.buttonUnfollow,
          opacity: this.props.disabled ? styles.buttonUnfollow.disabledOpacity : 1
        }
        break
      case 'Danger':
        backgroundStyle = {
          ...styles.buttonDanger,
          opacity: this.props.disabled ? styles.buttonDanger.disabledOpacity : 1
        }
        break
      case 'Secondary':
      default:
        backgroundStyle = {
          ...styles.buttonSecondary,
          opacity: this.props.disabled ? styles.buttonSecondary.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColorsDZ2.black75
        }
    }
    return {backgroundStyle, labelStyle}
  }

  render () {
    // First apply styles for the main button types.
    let {backgroundStyle, labelStyle} = this._styles(this.props.type)
    let smallStyle = {}

    // Then some overrides that apply to all button types.
    if (this.props.small) {
      smallStyle = styles.buttonSmall
      labelStyle = {
        ...labelStyle,
        ...styles.buttonSmallLabel
      }
    }

    if (this.props.fullWidth) {
      backgroundStyle = {
        ...backgroundStyle,
        // Using minWidth here means we can't have a full-width button on the
        // same line/row as another button, the right thing is very unlikely to
        // happen.  The alternative is 'flex: 1' here, which would work but is
        // dangerous, because we'd be modifying our container.
        //
        // So let's just say that a fullWidth button can't have siblings.
        minWidth: '100%'
      }
    }

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...backgroundStyle, ...smallStyle, ...this.props.style}}
        labelStyle={{...styles.buttonLabel, ...labelStyle}}
        label={this.props.label || this.props.more && '•••'}
        primary={this.props.type === 'Primary'}
        secondary={this.props.type === 'Secondary'}
        disabled={this.props.disabled}
      />
    )
  }
}

const buttonCommon2 = {
  ...globalStyles.fontSemibold,
  color: globalColorsDZ2.white,
  borderRadius: 55,
  fontSize: 16,
  height: 32,
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

export const styles = {
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
    backgroundColor: globalColorsDZ2.red,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonFollow: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.green,
    disabledOpacity: 0.3,
    marginRight: 10,
    minWidth: 125
  },
  buttonFollowing: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.white,
    border: `solid 2px ${globalColorsDZ2.green}`,
    marginRight: 10,
    minWidth: 125
  },
  buttonUnfollow: {
    ...buttonCommon2,
    backgroundColor: globalColorsDZ2.blue,
    disabledOpacity: 0.2,
    marginRight: 10,
    minWidth: 125
  },
  buttonSmall: {
    height: 28,
    lineHeight: '24px'
  },
  buttonLabel: {
    paddingLeft: 25,
    paddingRight: 25
  },
  buttonSmallLabel: {
    ...globalStyles.fontRegular,
    paddingLeft: 20,
    paddingRight: 20
  }
}
