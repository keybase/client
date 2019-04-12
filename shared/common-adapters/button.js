// @flow
/* eslint-disable sort-keys */
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

const Kb = {
  Box,
  ClickableBox,
  Icon,
  Text,
}

// Either type or backgroundColor must be set
export type Props = {|
  children?: React.Node,
  onClick?: null | ((event: SyntheticEvent<>) => void),
  onMouseEnter?: Function,
  onMouseLeave?: Function,
  label?: string,
  style?: StylesCrossPlatform,
  labelContainerStyle?: StylesCrossPlatform,
  labelStyle?: StylesCrossPlatform,
  type: 'Default' | 'Success' | 'Danger' | 'Wallet' | 'Dim',
  backgroundColor?: 'blue' | 'red' | 'green' | 'purple' | 'black',
  mode: 'Primary' | 'Secondary',
  disabled?: boolean,
  waiting?: boolean,
  small?: boolean,
  fullWidth?: boolean,
  className?: string,
|}

const Progress = ({small, white}) => (
  <Kb.Box style={styles.progressContainer}>
    <Kb.Icon
      style={castPlatformStyles(small ? styles.progressSmall : styles.progressNormal)}
      type={white ? 'icon-progress-white-animated' : 'icon-progress-grey-animated'}
    />
  </Kb.Box>
)

class Button extends React.Component<Props> {
  static defaultProps = {
    mode: 'Primary',
    type: 'Default',
  }
  render() {
    let containerStyle = this.props.backgroundColor
      ? backgroundColorContainerStyles[this.props.mode]
      : containerStyles[this.props.mode + this.props.type]
    let labelStyle = this.props.backgroundColor
      ? backgroundColorLabelStyles[
          this.props.mode + (this.props.mode === 'Secondary' ? '' : this.props.backgroundColor)
        ]
      : labelStyles[this.props.mode + this.props.type]

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
      <Kb.ClickableBox
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
      >
        <Kb.Box
          style={collapseStyles([
            globalStyles.flexBoxRow,
            globalStyles.flexBoxCenter,
            styles.labelContainer,
            this.props.labelContainerStyle,
          ])}
        >
          {!this.props.waiting && this.props.children}
          {!!this.props.label && (
            <Kb.Text
              type={this.props.small ? 'BodySemibold' : 'BodyBig'}
              style={collapseStyles([labelStyle, this.props.labelStyle])}
            >
              {this.props.label}
            </Kb.Text>
          )}
          {!!this.props.waiting && <Progress small={this.props.small} white={whiteSpinner} />}
        </Kb.Box>
      </Kb.ClickableBox>
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

const commonSecondaryWhiteBg = platformStyles({
  common: {...common, backgroundColor: globalColors.white},
  isElectron: {border: `1px solid ${globalColors.black_20}`},
  isMobile: {borderStyle: 'solid', borderWidth: 2},
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
    maxWidth: isMobile ? undefined : 400,
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
    paddingLeft: globalMargins.xsmall,
    paddingRight: globalMargins.xsmall,
  },
})

// No backgroundColor styles
const makeSecondaryWhiteBgContainerStyle = borderColor =>
  platformStyles({
    common: commonSecondaryWhiteBg,
    isMobile: {borderColor},
  })
const containerStyles = styleSheetCreate({
  PrimaryDefault: {...common, backgroundColor: globalColors.blue},
  PrimarySuccess: {...common, backgroundColor: globalColors.green},
  PrimaryDanger: {...common, backgroundColor: globalColors.red},
  PrimaryWallet: {...common, backgroundColor: globalColors.purple2},
  PrimaryDim: {...common, backgroundColor: globalColors.lightGrey2},
  SecondaryDefault: makeSecondaryWhiteBgContainerStyle(globalColors.blue),
  SecondarySuccess: makeSecondaryWhiteBgContainerStyle(globalColors.green),
  SecondaryDanger: makeSecondaryWhiteBgContainerStyle(globalColors.red),
  SecondaryWallet: makeSecondaryWhiteBgContainerStyle(globalColors.purple2),
  SecondaryDim: makeSecondaryWhiteBgContainerStyle(globalColors.black_20),
})

const primaryWhiteBgLabel = {
  ...commonLabel,
  color: globalColors.white,
}
const labelStyles = styleSheetCreate({
  PrimaryDefault: primaryWhiteBgLabel,
  PrimarySuccess: primaryWhiteBgLabel,
  PrimaryDanger: primaryWhiteBgLabel,
  PrimaryWallet: primaryWhiteBgLabel,
  PrimaryDim: {...primaryWhiteBgLabel, color: globalColors.black},
  SecondaryDefault: {...commonLabel, color: globalColors.blue},
  SecondarySuccess: {...commonLabel, color: globalColors.green},
  SecondaryDanger: {...commonLabel, color: globalColors.red},
  SecondaryWallet: {...commonLabel, color: globalColors.purple},
  SecondaryDim: {...commonLabel, color: globalColors.black},
})

// With backgroundColor styles
const backgroundColorContainerStyles = styleSheetCreate({
  Primary: {...common, backgroundColor: globalColors.white},
  Secondary: {...common, backgroundColor: globalColors.black_20},
})

const backgroundColorLabelStyles = styleSheetCreate({
  Primaryblue: {...commonLabel, color: globalColors.blue},
  Primaryred: {...commonLabel, color: globalColors.red},
  Primarygreen: {...commonLabel, color: globalColors.green},
  Primarypurple: {...commonLabel, color: globalColors.purple},
  Primaryblack: {...commonLabel, color: globalColors.black},
  Secondary: {...commonLabel, color: globalColors.white},
})

export default Button
