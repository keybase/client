/* @flow */

import React, {Component} from 'react'
import {FlatButton} from 'material-ui'
import ProgressIndicator from './progress-indicator'
import {globalStyles, globalColors} from '../styles/style-guide'
import type {Props} from './button'

class Button extends Component {
  props: Props;

  _styles (type: Props.type): Object {
    let backgroundStyle = {}
    let labelStyle = {}
    let progressColor = globalColors.white
    let rippleStyle: {rippleColor?: string} = {rippleColor: 'rgba(0, 0, 0, 0.3)'}

    const disabled = this.props.disabled || this.props.waiting

    switch (this.props.type) {
      case 'Primary':
        backgroundStyle = {
          ...stylesButtonPrimary,
          opacity: disabled ? stylesButtonPrimary.disabledOpacity : 1,
        }
        break
      case 'Follow':
        backgroundStyle = {
          ...stylesButtonFollow,
          opacity: disabled ? stylesButtonFollow.disabledOpacity : 1,
        }
        break
      case 'Following':
        backgroundStyle = {
          ...stylesButtonFollowing,
          opacity: disabled ? stylesButtonFollowing.disabledOpacity : 1,
        }
        labelStyle = {
          color: globalColors.green,
        }
        progressColor = globalColors.black_75
        break
      case 'Unfollow':
        backgroundStyle = {
          ...stylesButtonUnfollow,
          opacity: disabled ? stylesButtonUnfollow.disabledOpacity : 1,
        }
        labelStyle = {
          color: globalColors.black_75,
        }
        break
      case 'Danger':
        backgroundStyle = {
          ...stylesButtonDanger,
          opacity: disabled ? stylesButtonDanger.disabledOpacity : 1,
        }
        break
      case 'Secondary':
      default:
        backgroundStyle = {
          ...stylesButtonSecondary,
          backgroundColor: this.props.backgroundMode === 'Terminal' ? globalColors.blue_30 : stylesButtonSecondary.backgroundColor,
          opacity: disabled ? stylesButtonSecondary.disabledOpacity : 1,
        }
        labelStyle = {
          color: this.props.backgroundMode === 'Terminal' ? globalColors.white : globalColors.black_75,
        }
        progressColor = globalColors.black_75
    }
    return {backgroundStyle, labelStyle, progressColor, rippleStyle}
  }

  render () {
    // First apply styles for the main button types.
    let {backgroundStyle, labelStyle, progressColor, rippleStyle} = this._styles(this.props.type)
    let smallStyle = {}

    // Then some overrides that apply to all button types.
    if (this.props.small) {
      smallStyle = stylesButtonSmall
      labelStyle = {
        ...labelStyle,
        ...stylesButtonSmallLabel,
      }
    }

    if (this.props.waiting) {
      labelStyle = {
        ...labelStyle,
        opacity: 0,
      }
    }

    let outerStyle = {position: 'relative'}
    if (this.props.style) {
      outerStyle = {...outerStyle, alignSelf: this.props.style.alignSelf}
    }

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
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}
          style={{...backgroundStyle, ...smallStyle, ...this.props.style}}
          labelStyle={{...stylesButtonLabel, ...labelStyle, ...this.props.labelStyle}}
          {...rippleStyle}
          label={label}
          primary={this.props.type === 'Primary'}
          secondary={this.props.type === 'Secondary'}
          disabled={this.props.disabled || this.props.waiting}>
          {this.props.waiting && (
            <ProgressIndicator
              white={progressColor === globalColors.white}
              style={{...stylesProgress}}
            />)}
        </FlatButton>
      </div>
    )
  }
}

const buttonCommon = {
  borderRadius: 55,
  fontSize: 16,
  height: 32,
  lineHeight: '32px',
  minWidth: 10,
}

const stylesButtonPrimary = {
  ...buttonCommon,
  backgroundColor: globalColors.blue,
  disabledOpacity: 0.2,
}
const stylesButtonSecondary = {
  ...buttonCommon,
  backgroundColor: globalColors.lightGrey2,
  disabledOpacity: 0.3,
  marginRight: 10,
}
const stylesButtonDanger = {
  ...buttonCommon,
  backgroundColor: globalColors.red,
  disabledOpacity: 0.2,
  marginRight: 10,
}
const stylesButtonFollow = {
  ...buttonCommon,
  backgroundColor: globalColors.green,
  disabledOpacity: 0.3,
  marginRight: 10,
  minWidth: 125,
}
const stylesButtonFollowing = {
  ...buttonCommon,
  backgroundColor: globalColors.white,
  border: `solid 2px ${globalColors.green}`,
  lineHeight: '28px',
  marginRight: 10,
  minWidth: 125,
}
const stylesButtonUnfollow = {
  ...stylesButtonSecondary,
  // mimic border width from following state to work around animation jitter during FollowButton hover transition
  border: `solid 2px ${globalColors.lightGrey2}`,
  lineHeight: '28px',
  marginRight: 10,
  minWidth: 125,
}
const stylesButtonSmall = {
  height: 28,
  lineHeight: '27px',
}
const stylesButtonLabel = {
  ...globalStyles.fontSemibold,
  paddingLeft: 25,
  paddingRight: 25,
  verticalAlign: 'initial',
  color: globalColors.white,
  whiteSpace: 'nowrap',
  fontSize: 16,
  height: 'auto',
  lineHeight: 0,
  textTransform: 'none',
}
const stylesButtonSmallLabel = {
  ...globalStyles.fontSemibold,
  fontSize: 14,
  paddingLeft: 20,
  paddingRight: 20,
  lineHeight: 0,
}
const stylesProgress = {
  position: 'absolute',
  height: 'calc(100% - 4px)',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  margin: 'auto',
}

export default Button
