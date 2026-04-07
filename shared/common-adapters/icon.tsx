import './icon.css'
import * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
export type {IconType} from './icon.constants-gen'
import type {Text as RNTextType} from 'react-native'

export type SizeType = 'Huge' | 'Bigger' | 'Big' | 'Default' | 'Small' | 'Tiny'

export type IconProps = {
  type: IconType
  color?: Styles.Color
  fontSize?: number
  sizeType?: SizeType
  style?: Styles.StylesCrossPlatform
  className?: string
  hoverColor?: Styles.Color
  hint?: string
  onClick?: () => void
  padding?: keyof typeof Styles.globalMargins
}

const sizeToFontDesktop = {Big: 24, Bigger: 36, Default: 16, Huge: 48, Small: 12, Tiny: 8} as const
const sizeToFontMobile = {Big: 32, Bigger: 48, Default: 20, Huge: 64, Small: 16, Tiny: 10} as const
const sizeToFont = Styles.isMobile ? sizeToFontMobile : sizeToFontDesktop

const cssVarToColorName = (cssVar: string): string | undefined => {
  const match = /^var\(--color-(.+)\)$/.exec(cssVar)
  return match?.[1]
}

const IconDesktop = (props: IconProps) => {
  const {type, color, fontSize, sizeType, style, className, hoverColor, hint, onClick, padding} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const size = fontSize ?? sizeToFont[sizeType ?? 'Default']
  const paddingValue = padding ? Styles.globalMargins[padding] : undefined
  const effectiveColor = color || Styles.globalColors.black_50
  // Use CSS class for color when it's a known CSS variable, so external CSS can override it.
  // Inline styles have higher specificity than CSS classes and break cases like the sidebar tab icons.
  const colorName = cssVarToColorName(effectiveColor)
  const colorClassName = colorName ? `color_${colorName}` : undefined
  const inlineStyle = Styles.castStyleDesktop(
    Styles.collapseStyles([
      !colorClassName && {color: effectiveColor},
      size !== 16 && {fontSize: size},
      paddingValue && {padding: paddingValue},
      style,
    ])
  )
  const hoverColorName = hoverColor ? cssVarToColorName(hoverColor) : undefined
  const hoverClassName = hoverColorName ? `hover_color_${hoverColorName}` : undefined
  const cn = Styles.classNames('icon', `icon-gen-${type}`, className, colorClassName, hoverClassName)

  const handleClick = onClick
    ? (e: React.MouseEvent) => {
        e.stopPropagation()
        onClick()
      }
    : undefined
  const finalStyle = onClick
    ? ({...inlineStyle, cursor: 'pointer'} as React.CSSProperties)
    : inlineStyle

  return <span className={cn} style={finalStyle} onClick={handleClick} title={hint} />
}

const nativeBaseStyle: Styles._StylesCrossPlatform = {
  color: Styles.globalColors.black_50,
  fontFamily: 'kb',
  fontWeight: 'normal' as const,
}

const IconNative = (props: IconProps) => {
  const {Text: RNText} = require('react-native') as {Text: typeof RNTextType}
  const {type, color, fontSize, sizeType, style, onClick, padding} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const code = String.fromCharCode(meta.charCode || 0)
  const size = fontSize ?? sizeToFont[sizeType ?? 'Default']
  const paddingValue = padding ? Styles.globalMargins[padding] : undefined

  return (
    <RNText
      style={Styles.castStyleNative(
        Styles.collapseStyles([
          nativeBaseStyle,
          {color: color || Styles.globalColors.black_50, fontSize: size},
          paddingValue && {padding: paddingValue},
          style,
        ])
      )}
      allowFontScaling={false}
      suppressHighlighting={true}
      onPress={onClick}
    >
      {code}
    </RNText>
  )
}

const Icon = Styles.isMobile ? IconNative : IconDesktop
export default Icon
