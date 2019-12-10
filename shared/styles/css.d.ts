import {CSSProperties} from 'react'
import {StyleProp, ViewStyle, TextStyle, ImageStyle} from 'react-native'

export type Color = null | string
type _StylesDesktopOverride = {
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'inherit' | 'initial' | 'unset' | 'break-word'
  WebkitAppRegion?: 'drag' | 'no-drag'
}

// only use a subset of the full CSSProperties for speed reasons
type StyleKeys =
  | 'alignContent'
  | 'alignItems'
  | 'alignSelf'
  | 'backgroundColor'
  | 'borderBottomColor'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'borderBottomWidth'
  | 'borderColor'
  | 'borderLeftColor'
  | 'borderLeftWidth'
  | 'borderRadius'
  | 'borderRightColor'
  | 'borderRightWidth'
  | 'borderStyle'
  | 'borderTopColor'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderTopWidth'
  | 'borderWidth'
  | 'bottom'
  | 'color'
  | 'direction'
  | 'display'
  | 'flex'
  | 'flexBasis'
  | 'flexDirection'
  | 'flexGrow'
  | 'flexShrink'
  | 'flexWrap'
  | 'fontFamily'
  | 'fontSize'
  | 'fontStyle'
  | 'fontVariant'
  | 'fontWeight'
  | 'height'
  | 'justifyContent'
  | 'left'
  | 'letterSpacing'
  | 'lineHeight'
  | 'margin'
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'
  | 'marginTop'
  | 'maxHeight'
  | 'maxWidth'
  | 'minHeight'
  | 'minWidth'
  | 'opacity'
  | 'overflow'
  | 'overflowX'
  | 'overflowY'
  | 'padding'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'position'
  | 'right'
  | 'textAlign'
  | 'textDecorationColor'
  | 'textDecorationLine'
  | 'textDecorationStyle'
  | 'top'
  | 'transform'
  | 'width'
  | 'zIndex'

export type _StylesDesktop = Pick<CSSProperties & _StylesDesktopOverride, StyleKeys>
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

export type CustomStyles<K extends string, C> = StyleProp<Omit<_StylesCrossPlatform, K> & C>
