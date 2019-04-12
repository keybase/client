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
  styled,
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

const SecondaryWhiteBgButton = isMobile
  ? Kb.ClickableBox
  : styled(Kb.ClickableBox)({
      backgroundColor: globalColors.white,
      '&:hover': {
        backgroundColor: 'rgba(77, 142, 255, 0.05)',
        border: '1px solid rgba(77, 142, 255, 0.2)!important',
      },
    })

const PrimaryUnderlay = isMobile
  ? () => null
  : styled(Kb.Box, {shouldForwardProp: prop => prop !== '_backgroundColor'})(props => ({
      ...globalStyles.fillAbsolute,
      borderRadius,
      transition: 'background-color 0.2s ease-out',
      '&:hover': {
        backgroundColor: props._backgroundColor,
      },
    }))

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

    const unclickable = this.props.disabled || this.props.waiting
    if (unclickable) {
      containerStyle = collapseStyles([containerStyle, styles.opacity30])
    }

    if (this.props.waiting) {
      labelStyle = collapseStyles([labelStyle, styles.opacity0])
    }

    containerStyle = collapseStyles([containerStyle, this.props.style])

    const onClick = (!unclickable && !this.props.waiting && this.props.onClick) || null
    const whiteSpinner = !(
      this.props.type === 'PrimaryGreenActive' ||
      this.props.type === 'Secondary' ||
      this.props.type === 'PrimaryColoredBackground'
    )

    let ButtonBox = Kb.ClickableBox
    if (this.props.mode === 'Secondary' && !this.props.backgroundColor && !unclickable) {
      // Add hover styles
      ButtonBox = SecondaryWhiteBgButton
    }

    let underlay = null
    if (this.props.mode === 'Primary' && !unclickable) {
      underlay = (
        <PrimaryUnderlay
          _backgroundColor={this.props.backgroundColor ? 'rgba(77, 142, 255, 0.05)' : globalColors.black_10}
        />
      )
    } else if (this.props.mode === 'Secondary' && !unclickable && this.props.backgroundColor) {
      // default 0.2 opacity + 0.15 here = 0.35 hover
      underlay = <PrimaryUnderlay _backgroundColor="rgba(0, 0, 0, 0.15)" />
    }

    return (
      <ButtonBox
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        hoverColor={globalColors.transparent}
      >
        {underlay}
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
      </ButtonBox>
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
    borderRadius,
    height: regularHeight,
    justifyContent: 'center',
  },
  isElectron: {
    display: 'inline-block',
    lineHeight: 'inherit',
    minWidth: '100px',
    paddingLeft: globalMargins.medium,
    paddingRight: globalMargins.medium,
  },
  isMobile: {
    minWidth: 120,
    paddingLeft: globalMargins.small,
    paddingRight: globalMargins.small,
  },
})

const commonSecondaryWhiteBg = platformStyles({
  common,
  isElectron: {
    border: `1px solid ${globalColors.black_20}`,
    transition: 'background-color 0.1s ease-out, border 0.3s ease-out',
  },
  isMobile: {borderStyle: 'solid', borderWidth: 2},
})

const commonLabel = platformStyles({
  common: {
    color: globalColors.white,
    textAlign: 'center',
  },
  isElectron: {whiteSpace: 'pre'},
  isMobile: {lineHeight: undefined},
})

const styles = styleSheetCreate({
  fullWidth: {
    alignSelf: undefined,
    flexGrow: 1,
    height: fullWidthHeight,
    width: '100%',
  },
  labelContainer: platformStyles({
    common: {height: '100%', position: 'relative'},
    isElectron: {pointerEvents: 'none'}, // need hover etc. to go through to underlay
  }),
  opacity0: {opacity: 0},
  opacity30: {opacity: 0.3},
  progressContainer: {...globalStyles.fillAbsolute, ...globalStyles.flexBoxCenter},
  progressNormal: {height: isMobile ? 32 : 24, width: isMobile ? 32 : 24},
  progressSmall: {height: isMobile ? 28 : 20, width: isMobile ? 28 : 20},
  small: {
    borderRadius,
    height: smallHeight,
    minWidth: undefined,
    paddingLeft: isMobile ? globalMargins.small : globalMargins.xsmall,
    paddingRight: isMobile ? globalMargins.small : globalMargins.xsmall,
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
  Secondary: platformStyles({
    common: {...common, backgroundColor: globalColors.black_20},
    isElectron: {transition: 'background-color 0.2s ease-out, border 0.2s ease-out'},
  }),
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
