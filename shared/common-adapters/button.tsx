import './button.css'
import type * as React from 'react'
import type {Pressable as PressableType, Text as RNTextType, View as ViewType} from 'react-native'
import * as Styles from '@/styles'
import type AnimationType from './animation'
import type {MeasureRef} from './measure-ref'
import type {IconType} from './icon.constants-gen'
import type {default as WithTooltipType} from './with-tooltip'
import type {default as IconComp} from './icon'

export type ButtonType = 'Default' | 'Success' | 'Danger' | 'Dim'

export type ButtonProps = {
  children?: React.ReactNode
  label?: string
  onClick?: (event: React.BaseSyntheticEvent) => void
  type?: ButtonType
  mode?: 'Primary' | 'Secondary'
  small?: boolean
  fullWidth?: boolean
  disabled?: boolean
  waiting?: boolean
  tooltip?: string
  style?: Styles.StylesCrossPlatform
  labelStyle?: Styles.StylesCrossPlatform
}

export const regularHeight = Styles.isMobile ? 40 : 32
export const smallHeight = Styles.isMobile ? 32 : 28

// Pre-computed container styles for all 8 mode+type combos
const baseContainer: Styles._StylesCrossPlatform = Styles.platformStyles({
  common: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderRadius: Styles.borderRadius,
    gap: Styles.globalMargins.xtiny,
    height: regularHeight,
    justifyContent: 'center',
  },
  isElectron: {
    cursor: 'pointer',
    display: 'inline-flex',
    lineHeight: 'inherit',
    minWidth: 100,
    paddingLeft: Styles.globalMargins.medium,
    paddingRight: Styles.globalMargins.medium,
    position: 'relative' as const,
    userSelect: 'none' as const,
  },
  isMobile: {
    minWidth: 120,
    paddingLeft: Styles.globalMargins.small,
    paddingRight: Styles.globalMargins.small,
  },
  isTablet: {alignSelf: 'center'},
})

const primaryContainers = Styles.styleSheetCreate(() => ({
  Danger: {...baseContainer, backgroundColor: Styles.globalColors.red},
  Default: {...baseContainer, backgroundColor: Styles.globalColors.blue},
  Dim: {...baseContainer, backgroundColor: Styles.globalColors.grey},
  Success: {...baseContainer, backgroundColor: Styles.globalColors.green},
}))

const secondaryContainer: Styles._StylesCrossPlatform = Styles.platformStyles({
  common: baseContainer,
  isElectron: {backgroundColor: Styles.globalColors.white},
  isMobile: {
    backgroundColor: Styles.globalColors.white,
    borderColor: Styles.globalColors.black_20,
    borderStyle: 'solid' as const,
    borderWidth: 1,
  },
})

// Pre-computed label styles
const baseLabel: Styles._StylesCrossPlatform = Styles.platformStyles({
  common: {color: Styles.globalColors.whiteOrWhite, textAlign: 'center'},
  isElectron: {whiteSpace: 'pre'},
})

const primaryLabelStyles = {
  Danger: baseLabel,
  Default: baseLabel,
  Dim: {...baseLabel, color: Styles.globalColors.black},
  Success: baseLabel,
} as const

const secondaryLabelStyles = {
  Danger: {...baseLabel, color: Styles.globalColors.redDark},
  Default: {...baseLabel, color: Styles.globalColors.blueDark},
  Dim: {...baseLabel, color: Styles.globalColors.black_50},
  Success: {...baseLabel, color: Styles.globalColors.greenDark},
} as const

const smallStyle = {
  borderRadius: Styles.borderRadius,
  height: smallHeight,
  minWidth: undefined,
  paddingLeft: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
  paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
} satisfies Styles._StylesCrossPlatform

const childrenOnlyStyle = {
  minWidth: undefined,
  paddingLeft: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
  paddingRight: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
  width: regularHeight,
} satisfies Styles._StylesCrossPlatform

const childrenOnlySmallStyle = {
  width: smallHeight,
} satisfies Styles._StylesCrossPlatform

const fullWidthStyle = {
  flexGrow: 1,
  maxWidth: 460,
  width: '100%',
} satisfies Styles._StylesCrossPlatform

const opacity30Style = {opacity: 0.3} satisfies Styles._StylesCrossPlatform
const opacity0Style = {opacity: 0} satisfies Styles._StylesCrossPlatform

const progressContainerStyle = {
  ...Styles.globalStyles.fillAbsolute,
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
} satisfies Styles._StylesCrossPlatform

const progressNormal = {height: Styles.isMobile ? 32 : 24, width: Styles.isMobile ? 32 : 24}
const progressSmall = {height: Styles.isMobile ? 28 : 20, width: Styles.isMobile ? 28 : 20}

const Progress = ({small, white}: {small?: boolean; white: boolean}) => {
  const {default: Animation} = require('./animation') as {default: typeof AnimationType}
  const animStyle = small ? progressSmall : progressNormal
  if (Styles.isMobile) {
    const {View} = require('react-native') as {View: typeof ViewType}
    return (
      <View style={Styles.castStyleNative(progressContainerStyle)}>
        <Animation animationType={white ? 'spinnerWhite' : 'spinner'} style={animStyle} />
      </View>
    )
  }
  return (
    <div style={Styles.castStyleDesktop(progressContainerStyle)}>
      <Animation animationType={white ? 'spinnerWhite' : 'spinner'} style={animStyle} />
    </div>
  )
}

type FullProps = ButtonProps & {ref?: React.Ref<MeasureRef | null>}

const ButtonDesktop = (props: FullProps) => {
  const {children, label, onClick, ref: measureRef, type = 'Default', mode = 'Primary', small, fullWidth, disabled, waiting, tooltip, style, labelStyle: labelStyleOverride} = props
  const unclickable = disabled || waiting
  const isPrimary = mode === 'Primary'
  const hasChildrenOnly = !!children && !label

  const container = isPrimary ? primaryContainers[type] : secondaryContainer
  const labelStyle = isPrimary ? primaryLabelStyles[type] : secondaryLabelStyles[type]

  const needsCollapse = small || fullWidth || unclickable || hasChildrenOnly || style
  const containerStyle = needsCollapse
    ? Styles.collapseStyles([
        container,
        small && smallStyle,
        hasChildrenOnly && childrenOnlyStyle,
        hasChildrenOnly && small && childrenOnlySmallStyle,
        fullWidth && fullWidthStyle,
        unclickable && opacity30Style,
        style,
      ])
    : (container as Styles.StylesCrossPlatform)

  const className = Styles.classNames(
    isPrimary ? 'button--primary' : 'button--secondary',
    `button--type-${type}`,
    unclickable && 'button--disabled'
  )

  const handleClick = unclickable
    ? (e: React.MouseEvent) => e.stopPropagation()
    : onClick
      ? (e: React.MouseEvent) => {
          e.stopPropagation()
          onClick(e)
        }
      : undefined

  const whiteSpinner = isPrimary && type !== 'Dim'

  const btn = (
    <div className={className} style={Styles.castStyleDesktop(containerStyle)} onClick={handleClick} ref={measureRef as React.Ref<HTMLDivElement>}>
      {children}
      {!!label && (
        <span className="text_BodySemibold" style={Styles.castStyleDesktop(waiting ? Styles.collapseStyles([labelStyle, labelStyleOverride, opacity0Style]) : (labelStyleOverride ? Styles.collapseStyles([labelStyle, labelStyleOverride]) : (labelStyle as Styles.StylesCrossPlatform)))}>
          {label}
        </span>
      )}
      {!!waiting && <Progress small={small} white={whiteSpinner} />}
    </div>
  )

  if (tooltip) {
    const WithTooltip = (require('./with-tooltip') as {default: typeof WithTooltipType}).default
    return <WithTooltip tooltip={tooltip}>{btn}</WithTooltip>
  }
  return btn
}

const ButtonNative = (props: FullProps) => {
  const {Pressable, Text: RNText, View} = require('react-native') as {Pressable: typeof PressableType; Text: typeof RNTextType; View: typeof ViewType}
  const {children, label, onClick, type = 'Default', mode = 'Primary', small, fullWidth, disabled, waiting, style, labelStyle: labelStyleOverride} = props
  const unclickable = disabled || waiting
  const isPrimary = mode === 'Primary'
  const hasChildrenOnly = !!children && !label

  const container = isPrimary ? primaryContainers[type] : secondaryContainer
  const labelStyle = isPrimary ? primaryLabelStyles[type] : secondaryLabelStyles[type]

  const needsCollapse = small || fullWidth || unclickable || hasChildrenOnly || style
  const containerStyle = needsCollapse
    ? Styles.collapseStyles([
        container,
        small && smallStyle,
        hasChildrenOnly && childrenOnlyStyle,
        hasChildrenOnly && small && childrenOnlySmallStyle,
        fullWidth && fullWidthStyle,
        unclickable && opacity30Style,
        style,
      ])
    : (container as Styles.StylesCrossPlatform)

  const handlePress = unclickable ? undefined : onClick

  const whiteSpinner = isPrimary && type !== 'Dim'
  const fontWeight = '600' as const
  const fontSize = 16

  const inner = (
    <>
      {children}
      {!!label && (
        <RNText
          style={Styles.castStyleNative(
            waiting ? Styles.collapseStyles([labelStyle, labelStyleOverride, opacity0Style, {fontSize, fontWeight}]) : Styles.collapseStyles([labelStyle, labelStyleOverride, {fontSize, fontWeight}])
          )}
        >
          {label}
        </RNText>
      )}
      {!!waiting && <Progress small={small} white={whiteSpinner} />}
    </>
  )

  // Use View when no click handler so touches pass through to parent
  if (!handlePress) {
    return <View style={Styles.castStyleNative(containerStyle)}>{inner}</View>
  }

  return (
    <Pressable style={Styles.castStyleNative(containerStyle)} onPress={handlePress} accessible={true} accessibilityRole="button">
      {inner}
    </Pressable>
  )
}

const Button = Styles.isMobile ? ButtonNative : ButtonDesktop
export default Button

// IconButton — convenience wrapper that renders an Icon as a child
type IconButtonProps = Omit<ButtonProps, 'label' | 'children'> & {
  icon: IconType
  iconColor?: Styles.Color
}

export const IconButton = (props: IconButtonProps & {ref?: React.Ref<MeasureRef | null>}) => {
  const {icon, iconColor, ref, ...rest} = props
  const Icon = (require('./icon') as {default: typeof IconComp}).default
  const isPrimary = (rest.mode ?? 'Primary') === 'Primary'
  const type = rest.type ?? 'Default'
  const defaultColor = isPrimary
    ? type === 'Dim' ? Styles.globalColors.black : Styles.globalColors.whiteOrWhite
    : secondaryLabelStyles[type].color
  return (
    <Button ref={ref} {...rest}>
      <Icon type={icon} sizeType="Small" color={iconColor ?? (defaultColor as string)} />
    </Button>
  )
}
