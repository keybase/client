// @flow
import Box from './box'
import ClickableBox from './clickable-box'
import Icon, {castPlatformStyles} from './icon'
import * as React from 'react'
import Text from './text'
import {
  type StylesCrossPlatform,
  borderRadius,
  collapseStyles,
  globalColors,
  globalStyles,
  globalMargins,
  isMobile,
  platformStyles,
  styleSheetCreate,
} from '../styles'

export type Props = {|
  children?: React.Node,
  onClick?: null | ((event: SyntheticEvent<>) => void),
  onPress?: void,
  onMouseEnter?: Function,
  onMouseLeave?: Function,
  label?: string,
  style?: StylesCrossPlatform,
  labelContainerStyle?: StylesCrossPlatform,
  labelStyle?: StylesCrossPlatform,
  type:
    | 'Primary'
    | 'PrimaryPrivate'
    | 'Secondary'
    | 'Danger'
    | 'Wallet'
    | 'PrimaryGreen'
    | 'PrimaryGreenActive'
    | 'PrimaryColoredBackground'
    | 'SecondaryColoredBackground',
  disabled?: boolean,
  waiting?: boolean,
  small?: boolean,
  fullWidth?: boolean,
  backgroundMode?: 'Normal' | 'Terminal' | 'Red' | 'Green' | 'Blue' | 'Black',
  className?: string,
|}

const Progress = ({small, white}) => (
  <Box style={styles.progressContainer}>
    <Icon
      style={castPlatformStyles(small ? styles.progressSmall : styles.progressNormal)}
      type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
    />
  </Box>
)

class Button extends React.Component<Props> {
  render() {
    const backgroundModeName = this.props.backgroundMode
      ? {
          Black: 'Black',
          Blue: 'Blue',
          Green: 'Green',
          Normal: '',
          Red: 'Red',
          Terminal: 'OnTerminal',
        }[this.props.backgroundMode]
      : ''

    let containerStyle = containerStyles[this.props.type + backgroundModeName]
    let labelStyle = labelStyles[this.props.type + 'Label' + backgroundModeName]

    if (this.props.fullWidth) {
      containerStyle = collapseStyles([containerStyle, styles.fullWidth])
    }

    if (this.props.small) {
      containerStyle = collapseStyles([containerStyle, styles.small])
    }

    if (this.props.disabled || this.props.waiting) {
      containerStyle = collapseStyles([containerStyle, styles.opacity30])
    }

    if (this.props.waiting) {
      labelStyle = collapseStyles([labelStyle, styles.opacity0])
    }

    containerStyle = collapseStyles([containerStyle, this.props.style])

    const onClick = (!this.props.disabled && !this.props.waiting && this.props.onClick) || null
    const whiteSpinner = !(
      this.props.type === 'PrimaryGreenActive' ||
      this.props.type === 'Secondary' ||
      this.props.type === 'PrimaryColoredBackground'
    )

    return (
      <ClickableBox
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
      >
        <Box
          style={collapseStyles([
            globalStyles.flexBoxRow,
            globalStyles.flexBoxCenter,
            styles.labelContainer,
            this.props.labelContainerStyle,
          ])}
        >
          {!this.props.waiting && this.props.children}
          {!!this.props.label && (
            <Text
              type={this.props.small ? 'BodySemibold' : 'BodyBig'}
              style={collapseStyles([labelStyle, this.props.labelStyle])}
            >
              {this.props.label}
            </Text>
          )}
          {!!this.props.waiting && <Progress small={this.props.small} white={whiteSpinner} />}
        </Box>
      </ClickableBox>
    )
  }
}

const smallHeight = isMobile ? 32 : 28
const regularHeight = isMobile ? 40 : 32
const fullWidthHeight = isMobile ? 48 : 40

const common = platformStyles({
  common: {
    ...globalStyles.flexBoxColumn,
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius,
    height: regularHeight,
    justifyContent: 'center',
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  isElectron: {
    display: 'inline-block',
    lineHeight: 'inherit',
  },
})

const commonLabel = platformStyles({
  common: {
    color: globalColors.white,
    textAlign: 'center',
  },
  isElectron: {whiteSpace: 'pre'},
})

const styles = styleSheetCreate({
  fullWidth: {
    alignSelf: undefined,
    flexGrow: 1,
    height: fullWidthHeight,
    width: undefined,
  },
  labelContainer: {height: '100%', position: 'relative'},
  opacity0: {opacity: 0},
  opacity30: {opacity: 0.3},
  progressContainer: {...globalStyles.fillAbsolute, ...globalStyles.flexBoxCenter},
  progressNormal: {height: isMobile ? 32 : 24},
  progressSmall: {height: isMobile ? 28 : 20},
  small: {
    borderRadius,
    height: smallHeight,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
})

const containerStyles = styleSheetCreate({
  Custom: {},
  Danger: {...common, backgroundColor: globalColors.red},
  Primary: {...common, backgroundColor: globalColors.blue},
  PrimaryColoredBackgroundBlack: {...common, backgroundColor: globalColors.white},
  PrimaryColoredBackgroundBlue: {...common, backgroundColor: globalColors.white},
  PrimaryColoredBackgroundGreen: {...common, backgroundColor: globalColors.white},
  PrimaryColoredBackgroundRed: {...common, backgroundColor: globalColors.white},
  PrimaryGreen: {...common, backgroundColor: globalColors.green},
  PrimaryGreenActive: platformStyles({
    common: {
      ...common,
      backgroundColor: globalColors.white,
      borderColor: globalColors.green,
      borderWidth: 2,
    },
    isElectron: {borderStyle: 'solid'},
  }),
  PrimaryPrivate: {...common, backgroundColor: globalColors.darkBlue2},
  Secondary: {...common, backgroundColor: globalColors.lightGrey2},
  SecondaryColoredBackground: {...common, backgroundColor: globalColors.black_20},
  SecondaryOnTerminal: {...common, backgroundColor: globalColors.blue_30},
  Wallet: {...common, backgroundColor: globalColors.purple2},
})

const labelStyles = styleSheetCreate({
  CustomLabel: {color: globalColors.black_75, textAlign: 'center'},
  DangerLabel: commonLabel,
  PrimaryColoredBackgroundLabelBlack: {...commonLabel, color: globalColors.black},
  PrimaryColoredBackgroundLabelBlue: {...commonLabel, color: globalColors.blue},
  PrimaryColoredBackgroundLabelGreen: {...commonLabel, color: globalColors.green},
  PrimaryColoredBackgroundLabelRed: {...commonLabel, color: globalColors.red},
  PrimaryGreenActiveLabel: {...commonLabel, color: globalColors.green},
  PrimaryGreenLabel: commonLabel,
  PrimaryLabel: commonLabel,
  PrimaryPrivateLabel: commonLabel,
  SecondaryColoredBackgroundLabel: {...commonLabel, color: globalColors.white},
  SecondaryLabel: {...commonLabel, color: globalColors.black_75},
  SecondaryLabelOnTerminal: {...commonLabel, color: globalColors.white},
  WalletLabel: commonLabel,
})

export default Button
