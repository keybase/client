import {CSSProperties} from 'react'
import {ViewStyle, TextStyle, ImageStyle} from 'react-native'

type StyleProp<T> = T | Array<StyleProp<T>> | undefined | null | false

export type Color = null | string
type _StylesDesktopOverride = {
  backgroundImage?: string
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

export type _StylesDesktop = Readonly<Pick<CSSProperties, StyleKeys> & _StylesDesktopOverride>
export type StylesDesktop = StyleProp<_StylesDesktop>

type _StylesMobileOverride = {
  textAlignVertical?: 'auto' | 'top' | 'bottom' | 'center'
}

export type _StylesMobile = Readonly<ViewStyle & TextStyle & ImageStyle> & _StylesMobileOverride
export type StylesMobile = StyleProp<_StylesMobile>

// override some problematic styles
type _StylesCrossPlatformOverride = {
  fontSize: _StylesMobile['fontSize']
  fontWeight: _StylesMobile['fontWeight']
  textAlign: _StylesMobile['textAlign']
}

export type _StylesCrossPlatform = Readonly<
  {
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
>

export type StylesCrossPlatform = StyleProp<_StylesCrossPlatform>

export type _CustomStyles<K extends string, C> = Omit<_StylesCrossPlatform, K> & Readonly<C>
export type CustomStyles<K extends string, C> = StyleProp<_CustomStyles<K, C>>
