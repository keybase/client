// @flow
import Box from './box'
import ClickableBox from './clickable-box'
import ProgressIndicator from './progress-indicator'
import React, {Component} from 'react'
import Text from './text'
import {globalColors, globalStyles, globalMargins} from '../styles'
import {isMobile} from '../constants/platform'

import type {Props} from './button'

const Progress = ({small}) => (
  <Box style={progress}>
    <ProgressIndicator style={progressStyle(small)} white={false} />
  </Box>
)

class Button extends Component<void, Props, void> {
  render() {
    const backgroundModeName = this.props.backgroundMode
      ? {
          Normal: '',
          Terminal: 'OnTerminal',
        }[this.props.backgroundMode]
      : ''

    let containerStyle = {
      Custom,
      Danger,
      Follow,
      Following,
      Primary,
      Secondary,
      SecondaryOnTerminal,
      Unfollow,
    }[this.props.type + backgroundModeName]

    let labelStyle = {
      CustomLabel,
      DangerLabel,
      FollowLabel,
      FollowingLabel,
      PrimaryLabel,
      SecondaryLabel,
      SecondaryLabelOnTerminal,
      UnfollowLabel,
    }[this.props.type + 'Label' + backgroundModeName]

    if (this.props.fullWidth) {
      containerStyle = {...containerStyle, ...fullWidth}
    }

    if (this.props.small) {
      containerStyle = {...containerStyle, ...smallStyle}
    }

    if (this.props.disabled || this.props.waiting) {
      containerStyle = {...containerStyle, ...disabled[this.props.type]}
    }

    if (!isMobile && this.props.waiting) {
      labelStyle = {...labelStyle, opacity: 0}
    }

    containerStyle = {...containerStyle, ...this.props.style}

    const onPress = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null

    return (
      <ClickableBox style={containerStyle} onClick={onPress}>
        <Box style={{...globalStyles.flexBoxCenter, position: 'relative', height: '100%'}}>
          <Text
            type={this.props.small ? 'BodySemibold' : 'BodyBig'}
            style={{...labelStyle, ...this.props.labelStyle}}
          >
            {this.props.label}
          </Text>
          {this.props.waiting && <Progress small={this.props.small} />}
        </Box>
      </ClickableBox>
    )
  }
}

const smallHeight = isMobile ? 32 : 28
const regularHeight = isMobile ? 40 : 32
const fullWidthHeight = isMobile ? 48 : 32
const borderRadius = 50
const smallBorderRadius = isMobile ? 50 : 28

const common = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  alignSelf: 'center',
  borderRadius,
  height: regularHeight,
  justifyContent: 'center',
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  ...(isMobile
    ? {}
    : {
        display: 'inline-block',
        lineHeight: 'inherit',
      }),
}
const commonLabel = {
  color: globalColors.white,
  textAlign: 'center',
  ...(isMobile
    ? {}
    : {
        whiteSpace: 'pre',
      }),
}
const fullWidth = {
  alignSelf: undefined,
  height: fullWidthHeight,
  width: null,
}

const smallStyle = {
  height: smallHeight,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
  borderRadius: smallBorderRadius,
}

const disabled = {
  Custom: {opacity: 0.3},
  Danger: {opacity: 0.2},
  Follow: {opacity: 0.3},
  Following: {opacity: 0.3},
  Primary: {opacity: 0.2},
  Secondary: {opacity: 0.3},
  Unfollow: {opacity: 0.3},
}

const Primary = {
  ...common,
  backgroundColor: globalColors.blue,
}
const PrimaryLabel = {
  ...commonLabel,
}

const Secondary = {
  ...common,
  backgroundColor: globalColors.lightGrey2,
}
const SecondaryOnTerminal = {
  ...Secondary,
  backgroundColor: globalColors.blue_30,
}
const SecondaryLabel = {
  ...commonLabel,
  color: globalColors.black_75,
}
const SecondaryLabelOnTerminal = {
  ...SecondaryLabel,
  color: globalColors.white,
}

const Danger = {
  ...common,
  backgroundColor: globalColors.red,
}
const DangerLabel = {
  ...commonLabel,
}

const followCommon = {
  width: 142,
}

const Follow = {
  ...common,
  ...followCommon,
  backgroundColor: globalColors.green,
}
const FollowLabel = {
  ...commonLabel,
}

const Following = {
  ...common,
  ...followCommon,
  backgroundColor: globalColors.white,
  borderColor: globalColors.green,
  borderWidth: 2,
  ...(isMobile
    ? {}
    : {
        borderStyle: 'solid',
      }),
}
const FollowingLabel = {
  ...commonLabel,
  color: globalColors.green,
}

const Unfollow = {
  ...common,
  ...followCommon,
  backgroundColor: globalColors.lightGrey2,
}
const UnfollowLabel = {
  ...commonLabel,
  color: globalColors.black_75,
}

const Custom = {}
const CustomLabel = {
  color: globalColors.black_75,
  textAlign: 'center',
}

const progressStyle = small =>
  isMobile
    ? undefined
    : {
        height: small ? 20 : 20,
      }

const progress = isMobile
  ? {
      marginTop: -regularHeight / 2,
    }
  : {
      ...globalStyles.fillAbsolute,
      ...globalStyles.flexBoxCenter,
    }

export default Button
