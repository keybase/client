import './button2.css'
import * as React from 'react'
import type {Pressable as PressableType, Text as RNTextType, View as ViewType} from 'react-native'
import * as Styles from '@/styles'
import type AnimationType from './animation'
import type {MeasureRef} from './measure-ref'
import type {IconType} from './icon.constants-gen'
import type {default as WithTooltipType} from './with-tooltip'
import type {default as Icon2Comp} from './icon2'

export type Button2Type = 'Default' | 'Success' | 'Danger' | 'Dim'

export type Button2Props = {
  children?: React.ReactNode
  label?: string
  onClick?: (event: React.BaseSyntheticEvent) => void
  type?: Button2Type
  mode?: 'Primary' | 'Secondary'
  small?: boolean
  fullWidth?: boolean
  disabled?: boolean
  waiting?: boolean
  tooltip?: string
  style?: Styles.StylesCrossPlatform
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

const smallStyle: Styles._StylesCrossPlatform = {
  borderRadius: Styles.borderRadius,
  height: smallHeight,
  minWidth: undefined,
  paddingLeft: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
  paddingRight: Styles.isMobile ? Styles.globalMargins.small : Styles.globalMargins.xsmall,
}

const childrenOnlyStyle: Styles._StylesCrossPlatform = {
  minWidth: undefined,
  paddingLeft: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
  paddingRight: Styles.isMobile ? Styles.globalMargins.xtiny : Styles.globalMargins.tiny,
  width: regularHeight,
}

const childrenOnlySmallStyle: Styles._StylesCrossPlatform = {
  width: smallHeight,
}

const fullWidthStyle: Styles._StylesCrossPlatform = {
  flexGrow: 1,
  maxWidth: 460,
  width: '100%',
}

const opacity30Style: Styles._StylesCrossPlatform = {opacity: 0.3}
const opacity0Style: Styles._StylesCrossPlatform = {opacity: 0}

const progressContainerStyle: Styles._StylesCrossPlatform = {
  ...Styles.globalStyles.fillAbsolute,
  ...Styles.globalStyles.flexBoxColumn,
  alignItems: 'center',
  justifyContent: 'center',
}

const progressNormal = {height: Styles.isMobile ? 32 : 24, width: Styles.isMobile ? 32 : 24}
const progressSmall = {height: Styles.isMobile ? 28 : 20, width: Styles.isMobile ? 28 : 20}

const Progress = ({small, white}: {small?: boolean; white: boolean}) => {
  const {default: Animation} = require('./animation') as {default: typeof AnimationType}
  return Styles.isMobile ? (
    <Animation
      animationType={white ? 'spinnerWhite' : 'spinner'}
      style={small ? progressSmall : progressNormal}
    />
  ) : (
    <div style={Styles.castStyleDesktop(progressContainerStyle)}>
      <Animation
        animationType={white ? 'spinnerWhite' : 'spinner'}
        style={small ? progressSmall : progressNormal}
      />
    </div>
  )
}

type FullProps = Button2Props & {ref?: React.Ref<MeasureRef | null>}

const Button2Desktop = (props: FullProps) => {
  const {children, label, onClick, ref, type = 'Default', mode = 'Primary', small, fullWidth, disabled, waiting, tooltip, style} = props
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
    isPrimary ? 'button2--primary' : 'button2--secondary',
    `button2--type-${type}`,
    unclickable && 'button2--disabled'
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

  const divRef = React.useRef<HTMLDivElement>(null)
  React.useImperativeHandle(ref, () => ({
    divRef,
    measure: () => divRef.current?.getBoundingClientRect(),
  }), [])

  const btn = (
    <div className={className} style={Styles.castStyleDesktop(containerStyle)} onClick={handleClick} ref={divRef}>
      {children}
      {!!label && (
        <span className="text_BodySemibold" style={Styles.castStyleDesktop(waiting ? Styles.collapseStyles([labelStyle, opacity0Style]) : (labelStyle as Styles.StylesCrossPlatform))}>
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

const Button2Native = (props: FullProps) => {
  const {Pressable, Text: RNText} = require('react-native') as {Pressable: typeof PressableType; Text: typeof RNTextType; View: typeof ViewType}
  const {children, label, onClick, type = 'Default', mode = 'Primary', small, fullWidth, disabled, waiting, style} = props
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

  return (
    <Pressable style={Styles.castStyleNative(containerStyle)} onPress={handlePress} accessible={true} accessibilityRole="button">
      {children}
      {!!label && (
        <RNText
          style={Styles.castStyleNative(
            waiting ? Styles.collapseStyles([labelStyle, opacity0Style, {fontSize, fontWeight}]) : Styles.collapseStyles([labelStyle, {fontSize, fontWeight}])
          )}
        >
          {label}
        </RNText>
      )}
      {!!waiting && <Progress small={small} white={whiteSpinner} />}
    </Pressable>
  )
}

const Button2 = Styles.isMobile ? Button2Native : Button2Desktop
export default Button2

// IconButton — convenience wrapper that renders an Icon as a child
type IconButtonProps = Omit<Button2Props, 'label' | 'children'> & {
  icon: IconType
  iconColor?: Styles.Color
}

export const IconButton = (props: IconButtonProps & {ref?: React.Ref<MeasureRef | null>}) => {
  const {icon, iconColor, ref, ...rest} = props
  const Icon2 = (require('./icon2') as {default: typeof Icon2Comp}).default
  const isPrimary = (rest.mode ?? 'Primary') === 'Primary'
  const type = rest.type ?? 'Default'
  const defaultColor = isPrimary
    ? type === 'Dim' ? Styles.globalColors.black : Styles.globalColors.whiteOrWhite
    : secondaryLabelStyles[type].color
  return (
    <Button2 ref={ref} {...rest}>
      <Icon2 type={icon} sizeType="Small" color={iconColor ?? (defaultColor as string)} />
    </Button2>
  )
}
