import type {CSSProperties} from 'react'
import type {ViewStyle, TextStyle, ImageStyle} from 'react-native'

export type Color = null | string
type _StylesDesktopOverride = {
  backgroundImage?: string
  objectFit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'
  overflowX?: 'auto' | 'clip' | 'hidden' | 'scroll' | 'visible'
  overflowY?: 'auto' | 'clip' | 'hidden' | 'scroll' | 'visible'
  wordBreak?: 'normal' | 'break-all' | 'keep-all' | 'inherit' | 'initial' | 'unset' | 'break-word'
  WebkitAppRegion?: 'drag' | 'no-drag'
  WebkitBackgroundClip?: 'text'
}

// only use a subset of the full CSSProperties for speed reasons
type StyleKeys =
  | 'alignContent'
  | 'alignItems'
  | 'alignSelf'
  | 'backgroundColor'
  | 'backgroundRepeat'
  | 'backgroundSize'
  | 'border'
  | 'borderBottom'
  | 'borderBottomColor'
  | 'borderBottomLeftRadius'
  | 'borderBottomRightRadius'
  | 'borderBottomWidth'
  | 'borderColor'
  | 'borderLeft'
  | 'borderLeftColor'
  | 'borderLeftWidth'
  | 'borderRadius'
  | 'borderRight'
  | 'borderRightColor'
  | 'borderRightWidth'
  | 'borderStyle'
  | 'borderTop'
  | 'borderTopColor'
  | 'borderTopLeftRadius'
  | 'borderTopRightRadius'
  | 'borderTopWidth'
  | 'borderWidth'
  | 'bottom'
  | 'boxShadow'
  | 'color'
  | 'contain'
  | 'cursor'
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
  | 'outline'
  | 'overflow'
  | 'overflowWrap'
  | 'overflowX'
  | 'overflowY'
  | 'padding'
  | 'paddingBottom'
  | 'paddingLeft'
  | 'paddingRight'
  | 'paddingTop'
  | 'pointerEvents'
  | 'position'
  | 'resize'
  | 'right'
  | 'textAlign'
  | 'textDecoration'
  | 'textDecorationColor'
  | 'textDecorationLine'
  | 'textDecorationStyle'
  | 'textTransform'
  | 'textOverflow'
  | 'top'
  | 'transform'
  | 'transition'
  | 'visibility'
  | 'whiteSpace'
  | 'width'
  | 'willChange'
  | 'wordBreak'
  | 'wordWrap'
  | 'zIndex'

export type _StylesDesktop = _StylesDesktopOverride &
  Pick<CSSProperties, Exclude<StyleKeys, keyof _StylesDesktopOverride>>

type _StylesDesktopFalsy = _StylesDesktop | undefined | null | false
export type StylesDesktop = _StylesDesktopFalsy | ReadonlyArray<_StylesDesktopFalsy>

type _StylesMobileOverride = {
  textAlignVertical?: 'top' | 'bottom' | 'center'
  textAlign?: 'left' | 'right' | 'center' | 'justify'
}

export type _StylesMobile = ViewStyle &
  Omit<TextStyle, 'textAlignVertical' | 'textAlign'> &
  ImageStyle &
  _StylesMobileOverride
type _StylesMobileFalsy = _StylesMobile | undefined | null | false
export type StylesMobile = _StylesMobileFalsy | ReadonlyArray<_StylesMobileFalsy>

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
    ? _StylesMobile[k] & _StylesDesktop[k]
    : never
}

type _StylesCrossPlatformFalsy = _StylesCrossPlatform | undefined | null | false
export type StylesCrossPlatform = _StylesCrossPlatformFalsy | Array<_StylesCrossPlatformFalsy>

export type _CustomStyles<K extends string, C> = Omit<_StylesCrossPlatform, K> & C
export type _CustomStylesFalsy<K extends string, C> = _CustomStyles<K, C> | undefined | null | false
export type CustomStyles<K extends string, C> = _CustomStylesFalsy<K, C> | Array<_CustomStylesFalsy<K, C>>
