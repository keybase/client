/* @flow */

import React, {Component} from 'react'
import {FlatButton, CircularProgress} from 'material-ui'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './button'

export default class Button extends Component {
  props: Props;

  _styles (type: Props.type): Object {
    let backgroundStyle = {}
    let labelStyle = {}
    let progressColor = globalColors.white

    const disabled = this.props.disabled || this.props.waiting

    switch (this.props.type) {
      case 'Primary':
        backgroundStyle = {
          ...styles.buttonPrimary,
          opacity: disabled ? styles.buttonPrimary.disabledOpacity : 1
        }
        break
      case 'Follow':
        backgroundStyle = {
          ...styles.buttonFollow,
          opacity: disabled ? styles.buttonFollow.disabledOpacity : 1
        }
        break
      case 'Following':
        backgroundStyle = {
          ...styles.buttonFollowing,
          opacity: disabled ? styles.buttonFollowing.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColors.green
        }
        progressColor = globalColors.black75
        break
      case 'Unfollow':
        backgroundStyle = {
          ...styles.buttonUnfollow,
          opacity: disabled ? styles.buttonUnfollow.disabledOpacity : 1
        }
        break
      case 'Danger':
        backgroundStyle = {
          ...styles.buttonDanger,
          opacity: disabled ? styles.buttonDanger.disabledOpacity : 1
        }
        break
      case 'Secondary':
      default:
        backgroundStyle = {
          ...styles.buttonSecondary,
          opacity: disabled ? styles.buttonSecondary.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColors.black75
        }
        progressColor = globalColors.black75
    }
    return {backgroundStyle, labelStyle, progressColor}
  }

  render () {
    // First apply styles for the main button types.
    let {backgroundStyle, labelStyle, progressColor} = this._styles(this.props.type)
    let smallStyle = {}

    // Then some overrides that apply to all button types.
    if (this.props.small) {
      smallStyle = styles.buttonSmall
      labelStyle = {
        ...labelStyle,
        ...styles.buttonSmallLabel
      }
    }

    if (this.props.waiting) {
      labelStyle = {
        ...labelStyle,
        opacity: 0
      }
    }

    let outerStyle = {position: 'relative'}

    if (this.props.fullWidth) {
        // Using minWidth here means we can't have a full-width button on the
        // same line/row as another button, the right thing is very unlikely to
        // happen.  The alternative is 'flex: 1' here, which would work but is
        // dangerous, because we'd be modifying our container.
        //
        // So let's just say that a fullWidth button can't have siblings.
      outerStyle = {...outerStyle, minWidth: '100%'}
      backgroundStyle = {...backgroundStyle, minWidth: '100%', height: 38}
    }

    if (this.props.waiting) {
      outerStyle = {...outerStyle, cursor: 'wait'}
    }

    let label = this.props.label

    if (this.props.more) {
      label = '•••'
    }

    return (
      <div style={outerStyle}>
        <FlatButton
          onClick={this.props.onClick}
          style={{...backgroundStyle, ...smallStyle, ...this.props.style}}
          labelStyle={{...styles.buttonLabel, ...labelStyle}}
          label={label}
          primary={this.props.type === 'Primary'}
          secondary={this.props.type === 'Secondary'}
          disabled={this.props.disabled || this.props.waiting}/>
        {this.props.waiting && (
          <CircularProgress
            size={0.25}
            style={{...styles.progress}}
            color={progressColor}
          />)}
      </div>
    )
  }
}

const buttonCommon = {
  ...globalStyles.DZ2.fontSemibold,
  color: globalColors.white,
  whiteSpace: 'nowrap',
  borderRadius: 55,
  fontSize: 16,
  height: 32,
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

const styles = {
  buttonPrimary: {
    ...buttonCommon,
    backgroundColor: globalColors.blue,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonSecondary: {
    ...buttonCommon,
    backgroundColor: globalColors.lightGrey2,
    disabledOpacity: 0.3,
    marginRight: 10
  },
  buttonDanger: {
    ...buttonCommon,
    backgroundColor: globalColors.red,
    disabledOpacity: 0.2,
    marginRight: 10
  },
  buttonFollow: {
    ...buttonCommon,
    backgroundColor: globalColors.green,
    disabledOpacity: 0.3,
    marginRight: 10,
    minWidth: 125
  },
  buttonFollowing: {
    ...buttonCommon,
    backgroundColor: globalColors.white,
    border: `solid 2px ${globalColors.green}`,
    marginRight: 10,
    minWidth: 125
  },
  buttonUnfollow: {
    ...buttonCommon,
    backgroundColor: globalColors.blue,
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
    ...globalStyles.DZ2.fontRegular,
    paddingLeft: 20,
    paddingRight: 20
  },
  progress: {
    position: 'absolute',
    left: 'calc(50% - 32px)',
    top: -10
  }
}
