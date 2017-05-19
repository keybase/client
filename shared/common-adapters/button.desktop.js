// @flow
import ProgressIndicator from './progress-indicator'
import React, {Component} from 'react'
import type {Props} from './button'
import {globalStyles, globalColors, globalMargins} from '../styles'

class Button extends Component<void, Props, void> {
  _styles(type: $PropertyType<Props, 'type'>): Object {
    let backgroundStyle = {}
    let labelStyle = {}
    let progressColor = globalColors.white

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
          backgroundColor: this.props.backgroundMode === 'Terminal'
            ? globalColors.blue_30
            : stylesButtonSecondary.backgroundColor,
          opacity: disabled ? stylesButtonSecondary.disabledOpacity : 1,
        }
        labelStyle = {
          color: this.props.backgroundMode === 'Terminal' ? globalColors.white : globalColors.black_75,
        }
        progressColor = globalColors.black_75
    }
    return {backgroundStyle, labelStyle, progressColor}
  }

  render() {
    // First apply styles for the main button types.
    let {backgroundStyle, labelStyle, progressColor} = this._styles(this.props.type)
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
      if (__DEV__) {
        console.warn('fullwidth disabled on desktop buttons')
      }
    }

    if (this.props.waiting) {
      outerStyle = {...outerStyle, cursor: 'wait'}
    }

    return (
      <div style={outerStyle} className={this.props.className}>
        <div
          onClick={this.props.onClick}
          onMouseEnter={this.props.onMouseEnter}
          onMouseLeave={this.props.onMouseLeave}
          style={{...backgroundStyle, ...smallStyle, ...this.props.style}}
        >
          <span style={{...stylesButtonLabel, ...labelStyle, ...this.props.labelStyle}}>
            {this.props.label}
          </span>
          {this.props.waiting &&
            <ProgressIndicator white={progressColor === globalColors.white} style={{...stylesProgress}} />}
        </div>
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
  color: globalColors.white,
  display: 'block',
  fontSize: 14,
  height: '100%',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  textAlign: 'center',
  textTransform: 'none',
  whiteSpace: 'nowrap',
  width: '100%',
}
const stylesButtonSmallLabel = {
  ...globalStyles.fontSemibold,
  fontSize: 13,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  lineHeight: 0,
}
const stylesProgress = {
  position: 'absolute',
  height: 'calc(100% - 8px)',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
  margin: 'auto',
}

export default Button
