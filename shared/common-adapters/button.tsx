/* eslint-disable sort-keys */
import Badge from './badge'
import {Box, Box2} from './box'
import ClickableBox from './clickable-box'
import Icon from './icon'
import WithTooltip from './with-tooltip'
import * as React from 'react'
import Text, {StylesTextCrossPlatform} from './text'
import * as Styles from '../styles'
import './button.css'
import {IconType} from './icon.constants-gen'

const Kb = {
  Badge,
  Box,
  Box2,
  ClickableBox,
  Icon,
  Text,
  WithTooltip,
}

export type ButtonType = 'Default' | 'Success' | 'Danger' | 'Wallet' | 'Dim'
export type ButtonColor = 'blue' | 'red' | 'green' | 'purple' | 'black' | 'yellow'

// if icon exists, tooltip MUST exist
type WithIconProps =
  | {
      icon?: never
    }
  | {
      icon: IconType
      iconColor?: Styles.Color
    }

// Either type or backgroundColor must be set
type DefaultProps = {
  backgroundColor?: ButtonColor
  badgeNumber?: number
  children?: React.ReactNode
  className?: string
  disabled?: boolean
  fullWidth?: boolean
  label?: string
  labelContainerStyle?: Styles.StylesCrossPlatform
  labelStyle?: Styles.StylesCrossPlatform
  mode?: 'Primary' | 'Secondary'
  narrow?: boolean
  onClick?: (event: React.BaseSyntheticEvent) => void
  onMouseEnter?: (e: React.MouseEvent) => void
  onMouseLeave?: (e: React.MouseEvent) => void
  small?: boolean
  style?: Styles.StylesCrossPlatform
  subLabel?: string
  subLabelStyle?: Styles.StylesCrossPlatform
  tooltip?: string
  type?: ButtonType
  waiting?: boolean
}

export type Props = DefaultProps & WithIconProps

const Progress = ({small, white}: {small?: boolean; white: boolean}) => {
  const Animation = require('./animation').default
  return (
    <Kb.Box style={styles.progressContainer}>
      <Animation
        animationType={white ? 'spinnerWhite' : 'spinner'}
        style={small ? styles.progressSmall : styles.progressNormal}
      />
    </Kb.Box>
  )
}

const Button = React.forwardRef<ClickableBox, Props>((props: Props, ref: React.Ref<ClickableBox>) => {
  const {mode = 'Primary', type = 'Default'} = props
  let containerStyle: Styles.StylesCrossPlatform = props.backgroundColor
    ? backgroundColorContainerStyles[mode as any]
    : containerStyles[(mode + type) as any]
  let labelStyle: StylesTextCrossPlatform = props.backgroundColor
    ? (backgroundColorLabelStyles[mode + (mode === 'Secondary' ? '' : props.backgroundColor)] as any)
    : labelStyles[mode + type]

  if (props.fullWidth) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.fullWidth])
  }

  if (props.small) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.small])
  }

  if (props.icon) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.icon])
  }

  if (props.narrow) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.narrow])
  }

  const unclickable = props.disabled || props.waiting
  if (unclickable) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.opacity30])
  }

  if (props.waiting) {
    labelStyle = Styles.collapseStyles([labelStyle, styles.opacity0])
  }

  containerStyle = Styles.collapseStyles([containerStyle, props.style])

  const onClick =
    !unclickable && props.onClick
      ? (e: React.BaseSyntheticEvent) => {
          e.stopPropagation()
          props.onClick && props.onClick(e)
        }
      : undefined
  const whiteSpinner =
    (mode === 'Primary' && !(props.backgroundColor || type === 'Dim')) ||
    (mode === 'Secondary' && !!props.backgroundColor)

  // Hover border colors
  const classNames: Array<string> = []
  if (mode === 'Secondary' && !props.backgroundColor) {
    // base grey border
    classNames.push('button__border')
    if (!unclickable) {
      // hover effect
      classNames.push(`button__border_${typeToColorName[type]}`)
    }
  }

  // Hover background colors
  const underlayClassNames: Array<string> = []
  if (mode === 'Primary' && !unclickable) {
    underlayClassNames.push(
      'button__underlay',
      props.backgroundColor ? `button__underlay_${props.backgroundColor}` : 'button__underlay_black10'
    )
  } else if (mode === 'Secondary' && !unclickable) {
    // default 0.2 opacity + 0.15 here = 0.35 hover
    underlayClassNames.push(
      'button__underlay',
      props.backgroundColor ? 'button__underlay_black' : `button__underlay_${typeToColorName[type]}`
    )
  }
  const underlay =
    !Styles.isMobile && underlayClassNames.length ? (
      <Kb.Box className={Styles.classNames(underlayClassNames)} />
    ) : null

  if (props.className) classNames.push(props.className)

  const content = (
    <Kb.ClickableBox
      ref={ref}
      className={Styles.classNames(classNames)}
      style={containerStyle}
      onClick={onClick}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
      hoverColor={Styles.globalColors.transparent}
    >
      {underlay}
      <Kb.Box
        style={Styles.collapseStyles([
          Styles.globalStyles.flexBoxRow,
          Styles.globalStyles.flexBoxCenter,
          styles.labelContainer,
          props.labelContainerStyle,
        ])}
      >
        {!props.waiting && props.children}
        <Kb.Box2 direction="vertical" centerChildren={true}>
          {!!props.label && (
            <Kb.Text type="BodySemibold" style={Styles.collapseStyles([labelStyle, props.labelStyle])}>
              {props.label}
            </Kb.Text>
          )}
          {!!props.subLabel && (
            <Kb.Text
              type="BodyTiny"
              style={Styles.collapseStyles([props.waiting && styles.opacity0, props.subLabelStyle])}
            >
              {props.subLabel}
            </Kb.Text>
          )}
          {!!props.icon && (
            <Kb.Icon
              type={props.icon}
              color={props.iconColor}
              sizeType="Default"
              style={Styles.collapseStyles([labelStyle, props.labelStyle])}
            />
          )}
        </Kb.Box2>
        {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />}
        {!!props.waiting && <Progress small={props.small} white={whiteSpinner} />}
      </Kb.Box>
    </Kb.ClickableBox>
  )
  if (props.tooltip) {
    return <Kb.WithTooltip tooltip={props.tooltip}>{content}</Kb.WithTooltip>
  }

  return content
})

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
      minWidth: 100,
      paddingLeft: Styles.globalMargins.medium,
      paddingRight: Styles.globalMargins.medium,
    },
    isMobile: {
      minWidth: 120,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isTablet: {
      alignSelf: 'center',
    },
  })

const styles = Styles.styleSheetCreate(() => ({
  badge: {
    marginLeft: Styles.globalMargins.xtiny,
    marginRight: 0,
  },
  fullWidth: {
    flexGrow: 1,
    maxWidth: 460,
    width: '100%',
  },
  icon: {
    borderRadius: Styles.borderRadius,
    minWidth: undefined,
    paddingLeft: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
    paddingRight: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
    width: regularHeight,
  },
  labelContainer: Styles.platformStyles({
    common: {height: '100%', position: 'relative'},
    isElectron: {pointerEvents: 'none'}, // need hover etc. to go through to underlay
  }),
  narrow: Styles.platformStyles({
    isElectron: {
      minWidth: 50,
      paddingLeft: Styles.globalMargins.small,
      paddingRight: Styles.globalMargins.small,
    },
    isMobile: {
      minWidth: 80,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
    },
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

const containerStyles: any = Styles.styleSheetCreate(() => {
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
      color: Styles.globalColors.whiteOrWhite,
      textAlign: 'center',
    },
    isElectron: {whiteSpace: 'pre'},
    isMobile: {lineHeight: undefined},
  })

const labelStyles: any = Styles.styleSheetCreate(() => {
  const primaryWhiteBgLabel = {
    ...commonLabel(),
    color: Styles.globalColors.whiteOrWhite,
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
const backgroundColorContainerStyles: any = Styles.styleSheetCreate(() => ({
  Primary: {...common(), backgroundColor: Styles.globalColors.white},
  Secondary: Styles.platformStyles({
    common: {...common(), backgroundColor: Styles.globalColors.black_20},
    isElectron: {transition: 'background-color 0.2s ease-out, border 0.2s ease-out'},
  }),
}))

const backgroundColorLabelStyles: any = Styles.styleSheetCreate(() => ({
  Primaryblue: {...commonLabel(), color: Styles.globalColors.blueDark},
  Primaryred: {...commonLabel(), color: Styles.globalColors.redDark},
  Primarygreen: {...commonLabel(), color: Styles.globalColors.greenDark},
  Primarypurple: {...commonLabel(), color: Styles.globalColors.purpleDark},
  Primaryblack: {...commonLabel(), color: Styles.globalColors.black},
  Primaryyellow: {...commonLabel(), color: Styles.globalColors.brown_75OrYellow},
  Secondary: {...commonLabel(), color: Styles.globalColors.white},
}))

export default Button
