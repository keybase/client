import './icon.css'
import * as Styles from '@/styles'
import {iconMeta} from './icon.constants-gen'
import type {IconType} from './icon.constants-gen'
import type {Text as RNTextType} from 'react-native'

export type SizeType2 = 'Big' | 'Default' | 'Small' | 'Tiny'

export type Icon2Props = {
  type: IconType
  color?: Styles.Color
  fontSize?: number
  sizeType?: SizeType2
  style?: Styles.StylesCrossPlatform
}

const sizeToFontDesktop = {Big: 24, Default: 16, Small: 12, Tiny: 8} as const
const sizeToFontMobile = {Big: 32, Default: 20, Small: 16, Tiny: 10} as const
const sizeToFont = Styles.isMobile ? sizeToFontMobile : sizeToFontDesktop

const Icon2Desktop = (props: Icon2Props) => {
  const {type, color, fontSize, sizeType = 'Default', style} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const size = fontSize ?? (meta.gridSize || sizeToFont[sizeType])
  const needsStyle = color || size !== 16 || style
  const inlineStyle = needsStyle
    ? Styles.castStyleDesktop(
        Styles.collapseStyles([color && {color}, size !== 16 && {fontSize: size}, style])
      )
    : undefined

  return <span className={`icon icon-gen-${type}`} style={inlineStyle} />
}

const nativeBaseStyle = {
  color: Styles.globalColors.black_50,
  fontFamily: 'kb',
  fontWeight: 'normal' as const,
} satisfies Styles._StylesCrossPlatform

const Icon2Native = (props: Icon2Props) => {
  const {Text: RNText} = require('react-native') as {Text: typeof RNTextType}
  const {type, color, fontSize, sizeType = 'Default', style} = props
  const meta = iconMeta[type]
  if (!meta.isFont) return null

  const code = String.fromCharCode(meta.charCode || 0)
  const size = fontSize ?? (meta.gridSize || sizeToFont[sizeType])

  return (
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
}

const Icon2 = Styles.isMobile ? Icon2Native : Icon2Desktop
export default Icon2
