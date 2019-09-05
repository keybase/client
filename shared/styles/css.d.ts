import {CSSProperties} from 'react'
import {StyleProp, ViewStyle, TextStyle, ImageStyle} from 'react-native'

export type _StylesDesktop = CSSProperties
export type StylesDesktop = StyleProp<_StylesDesktop>

export type _StylesMobile = ViewStyle | TextStyle | ImageStyle
export type StylesMobile = StyleProp<_StylesMobile>

type _StylesCrossPlatform = {
  // [k in keyof _StylesDesktop]: k extends keyof _StylesMobile
  // ? _StylesMobile[k] extends _StylesDesktop[k] // order important. mobile is stricter
  // ? _StylesMobile[k]
  // : never
  // : never

  [k in keyof _StylesDesktop]: k extends keyof _StylesMobile
    ? _StylesMobile[k] extends _StylesDesktop[k]
      ? _StylesMobile[k]
      : _StylesDesktop[k] extends _StylesMobile[k]
      ? _StylesDesktop[k]
      : never
    : never
}

type StyleObject = {[key: string]: _StylesCrossPlatform}

export type StylesCrossPlatform = StyleProp<_StylesCrossPlatform>

export type StylesCrossPlatformWithSomeDisallowed<D> = StyleProp<_StylesCrossPlatform & D>
