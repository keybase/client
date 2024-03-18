import './button.css'
import * as React from 'react'
import * as Styles from '@/styles'
import Badge from './badge'
import ClickableBox from './clickable-box'
import Icon, {type SizeType} from './icon'
import Text, {type StylesTextCrossPlatform} from './text'
import WithTooltip from './with-tooltip'
import type {IconType} from './icon.constants-gen'
import {Box, Box2} from './box'
import type {MeasureRef} from './measure-ref'
import type AnimationType from './animation'

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
      iconSizeType?: SizeType
      iconColor?: Styles.Color
      tooltip?: string
      label?: never
    }
  | {
      icon: IconType
      iconSizeType?: SizeType
      iconColor?: Styles.Color
      tooltip?: never
      label: string
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
  onMouseDown?: (e: React.MouseEvent) => void
  small?: boolean
  style?: Styles.StylesCrossPlatform
  subLabel?: string
  subLabelStyle?: Styles.StylesCrossPlatform
  tooltip?: string
  type?: ButtonType
  waiting?: boolean
  disabledStopClick?: boolean // if disabled it'll by default let clicks bleed through
}

export type Props = DefaultProps & WithIconProps

const Progress = ({small, white}: {small?: boolean; white: boolean}) => {
  const {default: Animation} = require('./animation') as {default: typeof AnimationType}
  return (
    <Kb.Box style={styles.progressContainer}>
      <Animation
        animationType={white ? 'spinnerWhite' : 'spinner'}
        style={small ? styles.progressSmall : styles.progressNormal}
      />
    </Kb.Box>
  )
}

const stopClick = (e: React.BaseSyntheticEvent) => {
  e.stopPropagation()
}

type ModeAndType =
  | 'PrimaryDefault'
  | 'PrimarySuccess'
  | 'PrimaryDanger'
  | 'PrimaryWallet'
  | 'PrimaryDim'
  | 'SecondaryDefault'
  | 'SecondarySuccess'
  | 'SecondaryDanger'
  | 'SecondaryWallet'
  | 'SecondaryDim'

type ModeAndBGColor =
  | 'Primaryblue'
  | 'Primaryred'
  | 'Primarygreen'
  | 'Primarypurple'
  | 'Primaryblack'
  | 'Primaryyellow'
  | 'Secondary'

const Button = React.forwardRef<MeasureRef, Props>(function ButtonInner(
  props: Props,
  ref: React.Ref<MeasureRef>
) {
  const {mode = 'Primary', type = 'Default'} = props
  const modeAndType = (mode + type) as ModeAndType
  const modeAndBGColor = (mode + (props.backgroundColor ?? '')) as ModeAndBGColor
  let containerStyle = props.backgroundColor
    ? (backgroundColorContainerStyles[mode] as Styles.StylesCrossPlatform)
    : (containerStyles[modeAndType] as Styles.StylesCrossPlatform)
  let labelStyle = props.backgroundColor
    ? (backgroundColorLabelStyles[mode === 'Secondary' ? mode : modeAndBGColor] as StylesTextCrossPlatform)
    : (labelStyles[modeAndType] as StylesTextCrossPlatform)

  if (props.fullWidth) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.fullWidth])
  }

  if (props.small) {
    containerStyle = Styles.collapseStyles([containerStyle, styles.small])
  }

  if (props.icon && !props.label) {
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
    labelStyle = Styles.collapseStyles([labelStyle, styles.opacity0]) as StylesTextCrossPlatform
  }

  containerStyle = Styles.collapseStyles([containerStyle, props.style])
  const {onClick: ponClick} = props
  const _onClick = React.useCallback(
    (e: React.BaseSyntheticEvent) => {
      e.stopPropagation()
      ponClick?.(e)
    },
    [ponClick]
  )
  const onClick = !unclickable && props.onClick ? _onClick : props.disabledStopClick ? stopClick : undefined
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
      onMouseDown={props.onMouseDown}
      hoverColor={Styles.globalColors.transparent}
      tooltip={props.tooltip}
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
        <Kb.Box2 direction={props.icon && props.label ? 'horizontal' : 'vertical'} centerChildren={true}>
          {!!props.icon && (
            <Kb.Icon
              type={props.icon}
              color={props.iconColor}
              sizeType={props.iconSizeType ?? 'Default'}
              style={Styles.collapseStyles([
                labelStyle,
                !!props.label && styles.iconWithLabel,
                props.labelStyle,
              ])}
            />
          )}
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
        </Kb.Box2>
        {!!props.badgeNumber && <Kb.Badge badgeNumber={props.badgeNumber} badgeStyle={styles.badge} />}
        {!!props.waiting && <Progress small={props.small} white={whiteSpinner} />}
      </Kb.Box>
    </Kb.ClickableBox>
  )
  if (props.disabled && props.tooltip && Styles.isMobile) {
    return (
      <Kb.WithTooltip tooltip={props.tooltip} showOnPressMobile={props.disabled}>
        {content}
      </Kb.WithTooltip>
    )
  }

  return content
})

const typeToColorName = {
  Danger: 'red',
  Default: 'blue',
  Dim: 'black',
  Success: 'green',
  Wallet: 'purple',
}

export const smallHeight = Styles.isMobile ? 32 : 28
export const regularHeight = Styles.isMobile ? 40 : 32

const common: () => Styles._StylesCrossPlatform = () =>
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
  iconWithLabel: {
    paddingRight: Styles.globalMargins.xtiny,
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
    PrimaryDanger: {...common(), backgroundColor: Styles.globalColors.red},
    PrimaryDefault: {...common(), backgroundColor: Styles.globalColors.blue},
    PrimaryDim: {...common(), backgroundColor: Styles.globalColors.grey},
    PrimarySuccess: {...common(), backgroundColor: Styles.globalColors.green},
    PrimaryWallet: {...common(), backgroundColor: Styles.globalColors.purple},
    SecondaryDanger: commonSecondaryWhiteBg,
    SecondaryDefault: commonSecondaryWhiteBg,
    SecondaryDim: commonSecondaryWhiteBg,
    SecondarySuccess: commonSecondaryWhiteBg,
    SecondaryWallet: commonSecondaryWhiteBg,
  } as const
})

const commonLabel = () =>
  Styles.platformStyles({
    common: {
      color: Styles.globalColors.whiteOrWhite,
      display: 'flex',
      textAlign: 'center',
    },
    isElectron: {userSelect: 'none', whiteSpace: 'pre'},
    isMobile: {lineHeight: undefined},
  })

const labelStyles = Styles.styleSheetCreate(() => {
  const primaryWhiteBgLabel = {
    ...commonLabel(),
    color: Styles.globalColors.whiteOrWhite,
  }
  const secondaryLabel = {
    backgroundColor: Styles.globalColors.fastBlank,
  }
  return {
    PrimaryDanger: primaryWhiteBgLabel,
    PrimaryDefault: primaryWhiteBgLabel,
    PrimaryDim: {...primaryWhiteBgLabel, color: Styles.globalColors.black},
    PrimarySuccess: primaryWhiteBgLabel,
    PrimaryWallet: primaryWhiteBgLabel,
    SecondaryDanger: {...commonLabel(), ...secondaryLabel, color: Styles.globalColors.redDark},
    SecondaryDefault: {...commonLabel(), ...secondaryLabel, color: Styles.globalColors.blueDark},
    SecondaryDim: {...commonLabel(), ...secondaryLabel, color: Styles.globalColors.black_50},
    SecondarySuccess: {...commonLabel(), ...secondaryLabel, color: Styles.globalColors.greenDark},
    SecondaryWallet: {...commonLabel(), ...secondaryLabel, color: Styles.globalColors.purpleDark},
  } as const
})

// With backgroundColor styles
const backgroundColorContainerStyles = Styles.styleSheetCreate(
  () =>
    ({
      Primary: {...common(), backgroundColor: Styles.globalColors.white},
      Secondary: Styles.platformStyles({
        common: {...common(), backgroundColor: Styles.globalColors.black_20},
        isElectron: {transition: 'background-color 0.2s ease-out, border 0.2s ease-out'},
      }),
    }) as const
)

const backgroundColorLabelStyles = Styles.styleSheetCreate(
  () =>
    ({
      Primaryblack: {...commonLabel(), color: Styles.globalColors.black},
      Primaryblue: {...commonLabel(), color: Styles.globalColors.blueDark},
      Primarygreen: {...commonLabel(), color: Styles.globalColors.greenDark},
      Primarypurple: {...commonLabel(), color: Styles.globalColors.purpleDark},
      Primaryred: {...commonLabel(), color: Styles.globalColors.redDark},
      Primaryyellow: {...commonLabel(), color: Styles.globalColors.brown_75OrYellow},
      Secondary: {...commonLabel(), color: Styles.globalColors.white},
    }) as const
)

export default Button
