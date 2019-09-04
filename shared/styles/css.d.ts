import {CSSProperties} from 'react'
import {StyleProp, ViewStyle} from 'react-native'

type _StylesDesktop = CSSProperties
export type StylesDesktop = StyleProp<_StylesDesktop>

type _StylesMobile = ViewStyle
export type StylesMobile = StyleProp<_StylesMobile>

type _StylesCrossPlatform = {
  [k in keyof _StylesDesktop]: _StylesDesktop[k] extends _StylesMobile[k] ? _StylesDesktop[k] : never
}
export type StylesCrossPlatform = StyleProp<_StylesCrossPlatform>

export type StylesCrossPlatformWithSomeDisallowed<D> = StyleProp<_StylesCrossPlatform & D>
