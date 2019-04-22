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

    const unclickable = this.props.disabled || this.props.waiting
    if (unclickable) {
      containerStyle = collapseStyles([containerStyle, styles.opacity30])
    }

    if (this.props.waiting) {
      labelStyle = collapseStyles([labelStyle, styles.opacity0])
    }

    containerStyle = collapseStyles([containerStyle, this.props.style])

    const onClick = (!unclickable && this.props.onClick) || null
    const whiteSpinner =
      (this.props.mode === 'Primary' && !(this.props.backgroundColor || this.props.type === 'Dim')) ||
      (this.props.mode === 'Secondary' && !!this.props.backgroundColor)

    // Hover border colors
    let classNames = []
    if (this.props.mode === 'Secondary' && !this.props.backgroundColor) {
      // base grey border
      classNames.push('button__border')
      if (!unclickable) {
        // hover effect
        classNames.push(`button__border_${typeToColorName[this.props.type]}`)
      }
    }

    // Hover background colors
    let underlayClassNames = []
    if (this.props.mode === 'Primary' && !unclickable) {
      underlayClassNames.push(
        'button__underlay',
        this.props.backgroundColor
          ? `button__underlay_${this.props.backgroundColor}`
          : 'button__underlay_black10'
      )
    } else if (this.props.mode === 'Secondary' && !unclickable) {
      // default 0.2 opacity + 0.15 here = 0.35 hover
      underlayClassNames.push(
        'button__underlay',
        this.props.backgroundColor
          ? 'button__underlay_black'
          : `button__underlay_${typeToColorName[this.props.type]}`
      )
    }
    const underlay =
      !isMobile && underlayClassNames.length ? <Kb.Box className={underlayClassNames.join(' ')} /> : null

    return (
      <Kb.ClickableBox
        className={classNames.join(' ')}
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
            <Kb.Text type="BodySemibold" style={collapseStyles([labelStyle, this.props.labelStyle])}>
              {this.props.label}
            </Kb.Text>
          )}
          {!!this.props.waiting && <Progress small={this.props.small} white={whiteSpinner} />}
        </Kb.Box>
      </Kb.ClickableBox>
    )
  }
}

const typeToColorName = {
  Default: 'blue',
  Success: 'green',
  Danger: 'red',
  Wallet: 'purple',
  Dim: 'black',
}

const smallHeight = isMobile ? 32 : 28
const regularHeight = isMobile ? 40 : 32

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
    backgroundColor: globalColors.white,
    transition: 'border 0.3s ease-out',
  },
  isMobile: {
    backgroundColor: globalColors.white,
    borderColor: globalColors.black_20,
    borderStyle: 'solid',
    borderWidth: 1,
  },
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
    flexGrow: 1,
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

const containerStyles = styleSheetCreate({
  PrimaryDefault: {...common, backgroundColor: globalColors.blue},
  PrimarySuccess: {...common, backgroundColor: globalColors.green},
  PrimaryDanger: {...common, backgroundColor: globalColors.red},
  PrimaryWallet: {...common, backgroundColor: globalColors.purple2},
  PrimaryDim: {...common, backgroundColor: globalColors.lightGrey2},
  SecondaryDefault: commonSecondaryWhiteBg,
  SecondarySuccess: commonSecondaryWhiteBg,
  SecondaryDanger: commonSecondaryWhiteBg,
  SecondaryWallet: commonSecondaryWhiteBg,
  SecondaryDim: commonSecondaryWhiteBg,
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
  SecondaryDim: {...commonLabel, color: globalColors.black_50},
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
