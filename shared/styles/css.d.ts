import {CSSProperties} from 'react'
import {StyleProp, ViewStyle, TextStyle, ImageStyle} from 'react-native'

export type Color = null | string
type _StylesDesktopOverride = {
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'inherit' | 'initial' | 'unset' | 'break-word'
}
export type _StylesDesktop = CSSProperties & _StylesDesktopOverride
export type StylesDesktop = StyleProp<_StylesDesktop>

export type _StylesMobile = ViewStyle & TextStyle & ImageStyle
export type StylesMobile = StyleProp<_StylesMobile>

// override some problematic styles
type _StylesCrossPlatformOverride = {
  fontSize: _StylesMobile['fontSize']
  fontWeight: _StylesMobile['fontWeight']
  textAlign: _StylesMobile['textAlign']
}

export type _StylesCrossPlatform = {
  [k in keyof _StylesDesktop]: k extends keyof _StylesCrossPlatformOverride // use override
    ? _StylesCrossPlatformOverride[k] // or if its shared between desktop and mobile choose one which extends the other
    : k extends keyof _StylesMobile
    ? _StylesMobile[k] extends _StylesDesktop[k]
      ? _StylesMobile[k]
      : _StylesDesktop[k] extends _StylesMobile[k]
      ? _StylesDesktop[k]
      : never
    : never
}

export type StylesCrossPlatform = StyleProp<_StylesCrossPlatform>

export type StylesCrossPlatformWithSomeDisallowed<D> = StyleProp<_StylesCrossPlatform & D>
