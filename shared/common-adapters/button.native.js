// @flow
import ProgressIndicator from './progress-indicator'
import React, {Component} from 'react'
import type {Props} from './button'
import Text from './text'
import ClickableBox from './clickable-box'
import Box from './box'
import {globalColors, globalStyles, globalMargins} from '../styles'

const Progress = () => (
  <Box style={progress}>
    <ProgressIndicator />
  </Box>
)

class Button extends Component<void, Props, void> {
  render () {
    const backgroundModeName = this.props.backgroundMode ? {
      Terminal: 'OnTerminal',
      Normal: '',
    }[this.props.backgroundMode] : ''

    let containerStyle = {
      Primary,
      Secondary,
      SecondaryOnTerminal,
      Danger,
      Follow,
      Following,
      Unfollow,
      Custom,
    }[this.props.type + backgroundModeName]

    const labelStyle = {
      PrimaryLabel,
      SecondaryLabel,
      SecondaryLabelOnTerminal,
      DangerLabel,
      FollowLabel,
      FollowingLabel,
      UnfollowLabel,
      CustomLabel,
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

    containerStyle = {...containerStyle, ...this.props.style}

    const onPress = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null

    return (
      <ClickableBox style={containerStyle} onClick={onPress}>
        <Box>
          <Text type={this.props.small ? 'BodySemibold' : 'BodyBig'} style={{...labelStyle, ...this.props.labelStyle}}>{this.props.label}</Text>
          {this.props.waiting && <Progress />}
        </Box>
      </ClickableBox>
    )
  }
}

const smallHeight = 32
const regularHeight = 40
const fullWidthHeight = 48
const borderRadius = 50

const common = {
  ...globalStyles.flexBoxColumn,
  borderRadius,
  alignItems: 'center',
  justifyContent: 'center',
  height: regularHeight,
  paddingLeft: globalMargins.medium,
  paddingRight: globalMargins.medium,
  alignSelf: 'center',
}
const commonLabel = {
  color: globalColors.white,
  textAlign: 'center',
}
const fullWidth = {
  height: fullWidthHeight,
  alignSelf: undefined,
  width: null,
}

const smallStyle = {
  height: smallHeight,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const disabled = {
  Primary: {opacity: 0.2},
  Secondary: {opacity: 0.3},
  Danger: {opacity: 0.2},
  Follow: {opacity: 0.3},
  Following: {opacity: 0.3},
  Unfollow: {opacity: 0.3},
  Custom: {opacity: 0.3},
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
  textAlign: 'center',
  color: globalColors.black_75,
}

const progress = {
  marginTop: -regularHeight / 2,
}

export default Button
