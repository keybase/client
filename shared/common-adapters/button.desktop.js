/* @flow */

import React, {Component} from 'react'
import {FlatButton, CircularProgress} from 'material-ui'
import {globalStyles, globalColors, globalColorsDZ2} from '../styles/style-guide'
import type {Props} from './button'

export default class Button extends Component {
  props: Props;

  _render1 () {
    const rootStyle = this.props.type === 'Primary' ? styles1.buttonPrimary : styles1.buttonSecondary
    const smallStyle = this.props.small ? styles1.buttonSmall : {}
    const smallLabelStyle = this.props.small ? styles1.buttonSmallLabel : {}

    return (
      <FlatButton
        onClick={this.props.onClick}
        style={{...rootStyle, ...smallStyle, ...this.props.style}}
        labelStyle={{...styles1.buttonLabel, ...smallLabelStyle}}
        label={this.props.label}
        primary={this.props.type === 'Primary'}
        secondary={this.props.type === 'Secondary'}
      />
    )
  }

  _styles (type: Props.type): Object {
    let backgroundStyle = {}
    let labelStyle = {}
    let progressColor = globalColorsDZ2.white

    const disabled = this.props.disabled || this.props.waiting

    switch (this.props.type) {
      case 'Primary':
        backgroundStyle = {
          ...styles2.buttonPrimary,
          opacity: disabled ? styles2.buttonPrimary.disabledOpacity : 1
        }
        break
      case 'Follow':
        backgroundStyle = {
          ...styles2.buttonFollow,
          opacity: disabled ? styles2.buttonFollow.disabledOpacity : 1
        }
        break
      case 'Following':
        backgroundStyle = {
          ...styles2.buttonFollowing,
          opacity: disabled ? styles2.buttonFollowing.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColorsDZ2.green
        }
        progressColor = globalColorsDZ2.black75
        break
      case 'Unfollow':
        backgroundStyle = {
          ...styles2.buttonUnfollow,
          opacity: disabled ? styles2.buttonUnfollow.disabledOpacity : 1
        }
        break
      case 'Danger':
        backgroundStyle = {
          ...styles2.buttonDanger,
          opacity: disabled ? styles2.buttonDanger.disabledOpacity : 1
        }
        break
      case 'Secondary':
      default:
        backgroundStyle = {
          ...styles2.buttonSecondary,
          opacity: disabled ? styles2.buttonSecondary.disabledOpacity : 1
        }
        labelStyle = {
          color: globalColorsDZ2.black75
        }
        progressColor = globalColorsDZ2.black75
    }
    return {backgroundStyle, labelStyle, progressColor}
  }

  render () {
    if (!this.props.dz2) {
      return this._render1()
    }

    // First apply styles for the main button types.
    let {backgroundStyle, labelStyle, progressColor} = this._styles(this.props.type)
    let smallStyle = {}

    // Then some overrides that apply to all button types.
    if (this.props.small) {
      smallStyle = styles2.buttonSmall
      labelStyle = {
        ...labelStyle,
        ...styles2.buttonSmallLabel
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
          labelStyle={{...styles2.buttonLabel, ...labelStyle}}
          label={label}
          primary={this.props.type === 'Primary'}
          secondary={this.props.type === 'Secondary'}
          disabled={this.props.disabled || this.props.waiting}/>
        {this.props.waiting && (
          <CircularProgress
            size={0.25}
            style={{...styles2.progress}}
            color={progressColor}
          />)}
      </div>
    )
  }
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
  whiteSpace: 'nowrap',
  borderRadius: 55,
  fontSize: 16,
  height: 32,
  lineHeight: '24px',
  textTransform: 'none',
  minWidth: 10
}

const styles2 = {
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

const styles1 = {
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
    lineHeight: 18
  },
  buttonLabel: {
    paddingLeft: 24,
    paddingRight: 24
  },
  buttonSmallLabel: {
    paddingLeft: 10,
    paddingRight: 10
  }
}
