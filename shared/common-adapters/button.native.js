// @flow
import ProgressIndicator from './progress-indicator'
import React, {Component} from 'react'
import type {Props} from './button'
import {Text, ClickableBox, Box} from './index'
import {globalColors, globalStyles} from '../styles'

const Progress = () => (
  <Box style={{...progress}}>
    <ProgressIndicator />
  </Box>
)

class Button extends Component<void, Props, void> {
  render () {
    const backgroundModeName = this.props.backgroundMode ? {
      Terminal: 'OnTerminal',
      Normal: '',
    }[this.props.backgroundMode] : ''

    let style = {
      Primary,
      Secondary,
      SecondaryOnTerminal,
      Danger,
      Follow,
      Following,
      Unfollow,
    }[this.props.type + backgroundModeName]

    const labelStyle = {
      PrimaryLabel,
      SecondaryLabel,
      SecondaryLabelOnTerminal,
      DangerLabel,
      FollowLabel,
      FollowingLabel,
      UnfollowLabel,
    }[this.props.type + 'Label' + backgroundModeName]

    if (this.props.fullWidth) {
      style = {...style, ...fullWidth}
    }

    if (this.props.disabled || this.props.waiting) {
      style = {...style, ...disabled[this.props.type]}
    }

    const onPress = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null

    // Need this nested view to get around this RN issue: https://github.com/facebook/react-native/issues/1040
    return (
      <ClickableBox
        onClick={onPress}
        underlayColor={style.backgroundColor}
        style={{...style, ...this.props.style}}>
        <Box style={{alignItems: 'center', justifyContent: 'center'}}>
          <Text type='BodySemibold' style={{...labelStyle, ...this.props.labelStyle}}>{this.props.label}</Text>
          {this.props.waiting && <Progress />}
        </Box>
      </ClickableBox>
    )
  }
}

const regularHeight = 40
const fullWidthHeight = 48

const common = {
  ...globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
  height: regularHeight,
  borderRadius: 50,
  paddingLeft: 32,
  paddingRight: 32,
}
const commonLabel = {
  color: globalColors.white,
  textAlign: 'center',
}
const fullWidth = {
  height: fullWidthHeight,
  width: null,
}

const disabled = {
  Primary: {opacity: 0.2},
  Secondary: {opacity: 0.3},
  Danger: {opacity: 0.2},
  Follow: {opacity: 0.3},
  Following: {opacity: 0.3},
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
  width: 154,
  paddingLeft: 32,
  paddingRight: 32,
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
  paddingTop: 5,
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

const progress = {
  marginTop: -regularHeight / 2,
}

export default Button
