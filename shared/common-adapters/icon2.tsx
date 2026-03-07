import './icon.css'
import * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
import type {Text as RNTextType, Pressable as PressableType} from 'react-native'

export type SizeType2 = 'Huge' | 'Bigger' | 'Big' | 'Default' | 'Small' | 'Tiny'

export type Icon2Props = {
  type: IconType
  color?: Styles.Color
  fontSize?: number
  sizeType?: SizeType2
  style?: Styles.StylesCrossPlatform
  className?: string
  hoverColor?: Styles.Color
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

const Icon2Desktop = (props: Icon2Props) => {
  const {type, color, fontSize, sizeType = 'Default', style, className, hoverColor, onClick, padding} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const size = fontSize ?? (meta.gridSize || sizeToFont[sizeType])
  const paddingValue = padding ? Styles.globalMargins[padding] : undefined
  const effectiveColor = color || Styles.globalColors.black_50
  const inlineStyle = Styles.castStyleDesktop(
    Styles.collapseStyles([
      {color: effectiveColor},
      size !== 16 && {fontSize: size},
      paddingValue && {padding: paddingValue},
      style,
    ])
  )
  const hoverColorName = hoverColor ? cssVarToColorName(hoverColor as string) : undefined
  const hoverClassName = hoverColorName ? `hover_color_${hoverColorName}` : undefined
  const cn = Styles.classNames('icon', `icon-gen-${type}`, className, hoverClassName)

  if (onClick) {
    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation()
      onClick()
    }
    return (
      <div onClick={handleClick} style={styles.clickable as React.CSSProperties}>
        <span className={cn} style={inlineStyle} />
      </div>
    )
  }

  return <span className={cn} style={inlineStyle} />
}

const nativeBaseStyle: Styles._StylesCrossPlatform = {
  color: Styles.globalColors.black_50,
  fontFamily: 'kb',
  fontWeight: 'normal' as const,
}

const Icon2Native = (props: Icon2Props) => {
  const {Text: RNText} = require('react-native') as {Text: typeof RNTextType}
  const {type, color, fontSize, sizeType = 'Default', style, onClick, padding} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const code = String.fromCharCode(meta.charCode || 0)
  const size = fontSize ?? (meta.gridSize || sizeToFont[sizeType])
  const paddingValue = padding ? Styles.globalMargins[padding] : undefined

  const textEl = (
    <RNText
      style={Styles.castStyleNative(
        Styles.collapseStyles([nativeBaseStyle, {fontSize: size}, color && {color}, style])
      )}
      allowFontScaling={false}
      suppressHighlighting={true}
    >
      {code}
    </RNText>
  )

  if (onClick) {
    const {Pressable} = require('react-native') as {Pressable: typeof PressableType}
    return (
      <Pressable onPress={onClick} style={paddingValue ? {padding: paddingValue} : undefined}>
        {textEl}
      </Pressable>
    )
  }

  if (paddingValue) {
    return (
      <RNText
        style={Styles.castStyleNative(
          Styles.collapseStyles([
            nativeBaseStyle,
            {fontSize: size, padding: paddingValue},
            color && {color},
            style,
          ])
        )}
        allowFontScaling={false}
        suppressHighlighting={true}
      >
        {code}
      </RNText>
    )
  }

  return textEl
}

const clickable = {cursor: 'pointer'} as const
const styles = {clickable}

const Icon2 = Styles.isMobile ? Icon2Native : Icon2Desktop
export default Icon2
