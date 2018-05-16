// @flow
import Box from './box'
import ClickableBox from './clickable-box'
import ProgressIndicator from './progress-indicator'
import * as React from 'react'
import Text from './text'
import {
  type StylesCrossPlatform,
  collapseStyles,
  globalColors,
  globalStyles,
  globalMargins,
  isMobile,
} from '../styles'

export type Props = {
  children?: React.Node,
  onClick: ?(event: SyntheticEvent<>) => void,
  onPress?: void,
  onMouseEnter?: Function,
  onMouseLeave?: Function,
  label: ?string,
  style?: StylesCrossPlatform,
  labelStyle?: StylesCrossPlatform,
  type:
    | 'Primary'
    | 'PrimaryPrivate'
    | 'Secondary'
    | 'Danger'
    | 'Wallet'
    | 'PrimaryGreen'
    | 'PrimaryGreenActive',
  disabled?: ?boolean,
  waiting?: ?boolean,
  small?: boolean,
  fullWidth?: boolean,
  backgroundMode?: 'Normal' | 'Terminal',
  className?: string,
}

const Progress = ({small, white}) => (
  <Box style={progress}>
    <ProgressIndicator style={progressStyle(small)} white={white} />
  </Box>
)

class Button extends React.Component<Props> {
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
      Primary,
      PrimaryGreen,
      PrimaryGreenActive,
      PrimaryPrivate,
      Secondary,
      SecondaryOnTerminal,
      Wallet,
    }[this.props.type + backgroundModeName]

    let labelStyle = {
      CustomLabel,
      DangerLabel,
      PrimaryGreenActiveLabel,
      PrimaryGreenLabel,
      PrimaryLabel,
      PrimaryPrivateLabel,
      SecondaryLabel,
      SecondaryLabelOnTerminal,
      WalletLabel,
    }[this.props.type + 'Label' + backgroundModeName]

    if (this.props.fullWidth) {
      containerStyle = {...containerStyle, ...fullWidth}
    }

    if (this.props.small) {
      containerStyle = {...containerStyle, ...smallStyle}
    }

    if (this.props.disabled || this.props.waiting) {
      containerStyle = {...containerStyle, opacity: 0.3}
    }

    if (!isMobile && this.props.waiting) {
      labelStyle = {...labelStyle, opacity: 0}
    }

    containerStyle = collapseStyles([containerStyle, this.props.style])

    const onClick = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null

    const whiteSpinner = this.props.type !== 'PrimaryGreenActive'

    return (
      <ClickableBox style={containerStyle} onClick={onClick}>
        <Box
          style={{
            ...globalStyles.flexBoxRow,
            ...globalStyles.flexBoxCenter,
            position: 'relative',
            height: '100%',
          }}
        >
          {!this.props.waiting && this.props.children}
          {!this.props.waiting && (
            <Text
              type={this.props.small ? 'BodySemibold' : 'BodyBig'}
              style={collapseStyles([labelStyle, this.props.labelStyle])}
            >
              {this.props.label}
            </Text>
          )}
          {this.props.waiting && <Progress small={this.props.small} white={whiteSpinner} />}
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
  borderRadius: smallBorderRadius,
  height: smallHeight,
  paddingLeft: globalMargins.small,
  paddingRight: globalMargins.small,
}

const Primary = {...common, backgroundColor: globalColors.blue}
const PrimaryLabel = commonLabel
const PrimaryGreen = {...common, backgroundColor: globalColors.green}
const PrimaryGreenLabel = commonLabel
const PrimaryGreenActive = {
  ...common,
  backgroundColor: globalColors.white,
  borderColor: globalColors.green,
  borderWidth: 2,
  ...(isMobile ? {} : {borderStyle: 'solid'}),
}
const PrimaryGreenActiveLabel = {...commonLabel, color: globalColors.green}
const PrimaryPrivate = {...common, backgroundColor: globalColors.darkBlue2}
const PrimaryPrivateLabel = commonLabel
const Secondary = {...common, backgroundColor: globalColors.lightGrey2}
const SecondaryOnTerminal = {...Secondary, backgroundColor: globalColors.blue_30}
const SecondaryLabel = {...commonLabel, color: globalColors.black_75}
const SecondaryLabelOnTerminal = {...SecondaryLabel, color: globalColors.white}
const Wallet = {...common, backgroundColor: globalColors.purple2}
const WalletLabel = commonLabel
const Danger = {...common, backgroundColor: globalColors.red}
const DangerLabel = commonLabel
const Custom = {}
const CustomLabel = {color: globalColors.black_75, textAlign: 'center'}
const progressStyle = small => (isMobile ? undefined : {height: small ? 20 : 20})
const progress = isMobile ? null : {...globalStyles.fillAbsolute, ...globalStyles.flexBoxCenter}

export default Button
