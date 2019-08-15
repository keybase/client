/* eslint-disable sort-keys */
import Box from './box'
import ClickableBox from './clickable-box'
import Icon, {castPlatformStyles} from './icon'
import * as React from 'react'
import Text from './text'
import * as Styles from '../styles'

const Kb = {
  Box,
  ClickableBox,
  Icon,
  Text,
}

export type ButtonType = 'Default' | 'Success' | 'Danger' | 'Wallet' | 'Dim'
export type ButtonColor = 'blue' | 'red' | 'green' | 'purple' | 'black' | 'yellow'
// Either type or backgroundColor must be set
export type Props = {
  children?: React.ReactNode
  onClick?: (event: React.BaseSyntheticEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  label?: string
  style?: Styles.StylesCrossPlatform
  labelContainerStyle?: Styles.StylesCrossPlatform
  labelStyle?: Styles.StylesCrossPlatform
  type: ButtonType
  backgroundColor?: ButtonColor
  mode: 'Primary' | 'Secondary'
  disabled?: boolean
  waiting?: boolean
  small?: boolean
  fullWidth?: boolean
  className?: string
}

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
      containerStyle = Styles.collapseStyles([containerStyle, styles.fullWidth])
    }

    if (this.props.small) {
      containerStyle = Styles.collapseStyles([containerStyle, styles.small])
    }

    const unclickable = this.props.disabled || this.props.waiting
    if (unclickable) {
      containerStyle = Styles.collapseStyles([containerStyle, styles.opacity30])
    }

    if (this.props.waiting) {
      labelStyle = Styles.collapseStyles([labelStyle, styles.opacity0])
    }

    containerStyle = Styles.collapseStyles([containerStyle, this.props.style])

    const onClick = (!unclickable && this.props.onClick) || undefined
    const whiteSpinner =
      (this.props.mode === 'Primary' && !(this.props.backgroundColor || this.props.type === 'Dim')) ||
      (this.props.mode === 'Secondary' && !!this.props.backgroundColor)

    // Hover border colors
    let classNames: Array<string> = []
    if (this.props.mode === 'Secondary' && !this.props.backgroundColor) {
      // base grey border
      classNames.push('button__border')
      if (!unclickable) {
        // hover effect
        classNames.push(`button__border_${typeToColorName[this.props.type]}`)
      }
    }

    // Hover background colors
    let underlayClassNames: Array<string> = []
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
      !Styles.isMobile && underlayClassNames.length ? (
        <Kb.Box className={Styles.classNames(underlayClassNames)} />
      ) : null

    return (
      <Kb.ClickableBox
        className={Styles.classNames(classNames)}
        style={containerStyle}
        onClick={onClick}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}
        hoverColor={Styles.globalColors.transparent}
      >
        {underlay}
        <Kb.Box
          style={Styles.collapseStyles([
            Styles.globalStyles.flexBoxRow,
            Styles.globalStyles.flexBoxCenter,
            styles.labelContainer,
            this.props.labelContainerStyle,
          ])}
        >
          {!this.props.waiting && this.props.children}
          {!!this.props.label && (
            <Kb.Text type="BodySemibold" style={Styles.collapseStyles([labelStyle, this.props.labelStyle])}>
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

const smallHeight = Styles.isMobile ? 32 : 28
const regularHeight = Styles.isMobile ? 40 : 32

const common = () =>
  Styles.platformStyles({
    common: {
      ...Styles.globalStyles.flexBoxColumn,
      alignItems: 'center',
      borderRadius: Styles.borderRadius,
      height: regularHeight,
      justifyContent: 'center',
    },
    isElectron: {
      display: 'inline-block',
      lineHeight: 'inherit',
      minWidth: '100px',
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isMobile: {
      minWidth: 120,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
  })

const styles = Styles.styleSheetCreate(() => ({
  fullWidth: {
    flexGrow: 1,
    maxWidth: 460,
    width: '100%',
  },
  labelContainer: Styles.platformStyles({
    common: {height: '100%', position: 'relative'},
    isElectron: {pointerEvents: 'none'}, // need hover etc. to go through to underlay
  }),
  opacity0: {opacity: 0},
  opacity30: {opacity: 0.3},
  progressContainer: {...Styles.globalStyles.fillAbsolute, ...Styles.globalStyles.flexBoxCenter},
  progressNormal: {height: Styles.isMobile ? 32 : 24, width: Styles.isMobile ? 32 : 24},
  progressSmall: {height: Styles.isMobile ? 28 : 20, width: Styles.isMobile ? 28 : 20},
  small: {
    borderRadius: Styles.borderRadius,
    height: smallHeight,
    minWidth: undefined,
    paddingLeft: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
    paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
  },
}))

const containerStyles = Styles.styleSheetCreate(() => {
  const commonSecondaryWhiteBg = Styles.platformStyles({
    common: common(),
    isElectron: {
      backgroundColor: Styles.globalColors.white,
      transition: 'border 0.3s ease-out',
    },
    isMobile: {
      backgroundColor: Styles.globalColors.white,
      borderColor: Styles.globalColors.black_20,
      borderStyle: 'solid',
      borderWidth: 1,
    },
  })

  return {
    PrimaryDefault: {...common(), backgroundColor: Styles.globalColors.blue},
    PrimarySuccess: {...common(), backgroundColor: Styles.globalColors.green},
    PrimaryDanger: {...common(), backgroundColor: Styles.globalColors.red},
    PrimaryWallet: {...common(), backgroundColor: Styles.globalColors.purple},
    PrimaryDim: {...common(), backgroundColor: Styles.globalColors.grey},
    SecondaryDefault: commonSecondaryWhiteBg,
    SecondarySuccess: commonSecondaryWhiteBg,
    SecondaryDanger: commonSecondaryWhiteBg,
    SecondaryWallet: commonSecondaryWhiteBg,
    SecondaryDim: commonSecondaryWhiteBg,
  }
})

const commonLabel = () =>
  Styles.platformStyles({
    common: {
      color: Styles.globalColors.white,
      textAlign: 'center',
    },
    isElectron: {whiteSpace: 'pre'},
    isMobile: {lineHeight: undefined},
  })

const labelStyles = Styles.styleSheetCreate(() => {
  const primaryWhiteBgLabel = {
    ...commonLabel(),
    color: Styles.globalColors.white,
  }
  return {
    PrimaryDefault: primaryWhiteBgLabel,
    PrimarySuccess: primaryWhiteBgLabel,
    PrimaryDanger: primaryWhiteBgLabel,
    PrimaryWallet: primaryWhiteBgLabel,
    PrimaryDim: {...primaryWhiteBgLabel, color: Styles.globalColors.black},
    SecondaryDefault: {...commonLabel(), color: Styles.globalColors.blueDark},
    SecondarySuccess: {...commonLabel(), color: Styles.globalColors.greenDark},
    SecondaryDanger: {...commonLabel(), color: Styles.globalColors.redDark},
    SecondaryWallet: {...commonLabel(), color: Styles.globalColors.purpleDark},
    SecondaryDim: {...commonLabel(), color: Styles.globalColors.black_50},
  }
})

// With backgroundColor styles
const backgroundColorContainerStyles = Styles.styleSheetCreate(() => ({
  Primary: {...common(), backgroundColor: Styles.globalColors.white},
  Secondary: Styles.platformStyles({
    common: {...common(), backgroundColor: Styles.globalColors.black_20},
    isElectron: {transition: 'background-color 0.2s ease-out, border 0.2s ease-out'},
  }),
}))

const backgroundColorLabelStyles = Styles.styleSheetCreate(() => ({
  Primaryblue: {...commonLabel(), color: Styles.globalColors.blueDark},
  Primaryred: {...commonLabel(), color: Styles.globalColors.redDark},
  Primarygreen: {...commonLabel(), color: Styles.globalColors.greenDark},
  Primarypurple: {...commonLabel(), color: Styles.globalColors.purpleDark},
  Primaryblack: {...commonLabel(), color: Styles.globalColors.black},
  Primaryyellow: {...commonLabel(), color: Styles.globalColors.brown_75},
  Secondary: {...commonLabel(), color: Styles.globalColors.white},
}))

export default Button
