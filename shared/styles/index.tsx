import styleSheetCreateProxy, {type MapToStyles} from './style-sheet-proxy'
import {themed as globalColors, themed, colors, darkColors} from './colors'
import {StyleSheet, Dimensions} from 'react-native'
import {useDarkModeState} from '@/stores/darkmode'
import {isTablet, isPhone, getAssetPath} from '@/constants/platform'
import type * as CSS from './css'
import type {_StylesCrossPlatform, _StylesMobile, _StylesDesktop} from './css'
import type {Background} from '@/common-adapters/text.shared'

// ─── Global margins ───────────────────────────────────────────────────────────

export const globalMargins = {
  xxtiny: 2,
  xtiny: 4,
  tiny: 8,
  xsmall: 12,
  small: 16,
  medium: 24,
  mediumLarge: 32,
  large: 40,
  xlarge: 64,
} as const

export const backgroundModeToColor = {
  get Announcements() {
    return globalColors.blue
  },
  get Documentation() {
    return globalColors.blueDarker
  },
  get HighRisk() {
    return globalColors.red
  },
  get Information() {
    return globalColors.yellow
  },
  get Normal() {
    return globalColors.white
  },
  get Success() {
    return globalColors.green
  },
  get Terminal() {
    return globalColors.blueDarker2
  },
}

export const backgroundModeToTextColor = (backgroundMode: Background) => {
  switch (backgroundMode) {
    case 'Information':
      return globalColors.brown_75
    case 'Normal':
      return globalColors.black
    case 'Terminal':
      return globalColors.blueLighter
    default:
      return globalColors.white
  }
}

const flexCommon = isMobile ? {} : ({display: 'flex'} as const)
const utilBase = {
  fillAbsolute: {inset: 0, position: 'absolute'},
  flexBoxCenter: {...flexCommon, alignItems: 'center', justifyContent: 'center'},
  flexBoxColumn: {...flexCommon, flexDirection: 'column'},
  flexBoxColumnReverse: {...flexCommon, flexDirection: 'column-reverse'},
  flexBoxRow: {...flexCommon, flexDirection: 'row'},
  flexBoxRowReverse: {...flexCommon, flexDirection: 'row-reverse'},
  flexGrow: {flexGrow: 1},
  flexOne: {flex: 1},
  flexWrap: {flexWrap: 'wrap'},
  fullHeight: {height: '100%'},
  fullWidth: {width: '100%'},
  opacity0: {opacity: 0},
  positionRelative: {position: 'relative'},
  rounded: {borderRadius: 3},
} as const

type Unified<T> = {
  [P in keyof T]: P extends 'lineHeight' ? _StylesCrossPlatform[P] : T[P]
}
function unifyStyles<T extends {[key: string]: unknown}>(s: T): Unified<T> {
  if (!isMobile && Object.hasOwn(s, 'lineHeight') && typeof s['lineHeight'] === 'number') {
    return {
      ...s,
      lineHeight: s['lineHeight'] === 0 ? '0' : `${s['lineHeight']}px`,
    } as Unified<T>
  }
  return s as Unified<T>
}

const nostyle = {} as const
export function platformStyles<
  T extends {
    common?: _StylesCrossPlatform
    isMobile?: _StylesMobile
    isPhone?: _StylesMobile
    isTablet?: _StylesMobile
    isIOS?: _StylesMobile
    isAndroid?: _StylesMobile
    isElectron?: _StylesDesktop
  },
  OUT = _StylesCrossPlatform,
>(o: T): OUT {
  const ss = [
    ...(o.common ? [unifyStyles(o.common)] : []),
    ...(isMobile && o.isMobile ? [o.isMobile] : []),
    ...(isIOS && o.isIOS ? [o.isIOS] : []),
    ...(isAndroid && o.isAndroid ? [o.isAndroid] : []),
    ...(isPhone && o.isPhone ? [o.isPhone] : []),
    ...(isTablet && o.isTablet ? [o.isTablet] : []),
    ...(isElectron && o.isElectron ? [unifyStyles(o.isElectron)] : []),
  ]
  const fss = ss.filter(Boolean)
  if (fss.length === 0) {
    return nostyle as OUT
  }
  if (fss.length === 1) {
    const out = fss[0] as OUT
    return out
  }

  const out = Object.assign({}, ...fss) as OUT
  return out
}

export const padding = (top: number, right?: number, bottom?: number, left?: number) => ({
  paddingTop: top,
  paddingRight: right !== undefined ? right : top,
  paddingBottom: bottom !== undefined ? bottom : top,
  paddingLeft: left !== undefined ? left : right !== undefined ? right : top,
})

export const border = (color: string, width = 1, radius?: number, justBottom?: boolean) => ({
  borderColor: color,
  borderStyle: 'solid' as const,
  borderWidth: width,
  ...(radius !== undefined
    ? justBottom
      ? {borderBottomLeftRadius: radius, borderBottomRightRadius: radius}
      : {borderRadius: radius}
    : {}),
})

export const topDivider = () => ({
  borderStyle: 'solid' as const,
  borderTopColor: globalColors.black_10,
  borderTopWidth: 1,
  minHeight: 56,
})

export const roundedBottom = () => ({
  borderBottomLeftRadius: borderRadius,
  borderBottomRightRadius: borderRadius,
  overflow: 'hidden' as const,
})

export const textEllipsis = isMobile
  ? ({} as const)
  : ({overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'} as const)

export const paddingH = (n: number) => ({paddingLeft: n, paddingRight: n})
export const paddingV = (n: number) => ({paddingTop: n, paddingBottom: n})
export const marginH = (n: number) => ({marginLeft: n, marginRight: n})
export const marginV = (n: number) => ({marginTop: n, marginBottom: n})
export const size = (n: number) => ({height: n, width: n})

// ─── Font definitions ─────────────────────────────────────────────────────────

const fontCommonDesktop = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
}

const fontDesktop = {
  fontBold: {
    ...fontCommonDesktop,
    fontFamily: 'Keybase',
    fontWeight: '700' as const,
  },
  fontExtrabold: {
    ...fontCommonDesktop,
    fontFamily: 'Keybase',
    fontWeight: '800' as const,
  },
  fontRegular: {
    ...fontCommonDesktop,
    fontFamily: 'Keybase',
    fontWeight: '500' as const,
  },
  fontSemibold: {
    ...fontCommonDesktop,
    fontFamily: 'Keybase',
    fontWeight: '600' as const,
  },
  fontTerminal: {
    ...fontCommonDesktop,
    fontFamily: 'Source Code Pro',
    fontWeight: '500' as const,
  },
  fontTerminalSemibold: {
    ...fontCommonDesktop,
    fontFamily: 'Source Code Pro',
    fontWeight: '600' as const,
  },
  italic: {
    fontStyle: 'italic' as const,
  },
}

const fontNativeIOS = {
  fontBold: {fontFamily: 'Keybase' as const, fontWeight: '700' as const},
  fontExtrabold: {fontFamily: 'Keybase' as const, fontWeight: '800' as const},
  fontRegular: {fontFamily: 'Keybase' as const, fontWeight: '500' as const},
  fontSemibold: {fontFamily: 'Keybase' as const, fontWeight: '600' as const},
  fontTerminal: {fontFamily: 'Source Code Pro Medium' as const},
  fontTerminalSemibold: {fontFamily: 'Source Code Pro Semibold' as const, fontWeight: '600' as const},
  italic: {fontStyle: 'italic' as const},
}

const fontNativeAndroid = {
  // The fontFamily name must match the font file's name exactly on Android.
  fontBold: {fontFamily: 'keybase' as const, fontWeight: '700' as const},
  fontExtrabold: {fontFamily: 'keybase-extrabold' as const, fontWeight: '800' as const},
  fontRegular: {fontFamily: 'keybase-medium' as const, fontWeight: '500' as const},
  fontSemibold: {fontFamily: 'keybase-semibold' as const, fontWeight: '600' as const},
  fontTerminal: {fontFamily: 'SourceCodePro-Medium' as const},
  fontTerminalSemibold: {fontFamily: 'SourceCodePro-Semibold' as const, fontWeight: '600' as const},
  italic: {fontStyle: 'italic' as const},
}

const font = isMobile ? (isIOS ? fontNativeIOS : fontNativeAndroid) : fontDesktop

// ─── Utility styles ───────────────────────────────────────────────────────────

const utilDesktop = {
  ...utilBase,
  largeWidthPercent: '70%' as const,
  loadingTextStyle: {
    // this won't really work with dark mode
    backgroundColor: colors.greyLight,
    height: 16,
    marginBottom: globalMargins.tiny,
    marginTop: globalMargins.tiny,
  },
  mediumSubNavWidth: 260,
  mediumWidth: 400,
  shortSubNavWidth: 160,
}

const utilNative = {
  ...utilBase,
  largeWidthPercent: '70%' as const,
  loadingTextStyle: {
    backgroundColor: colors.greyLight,
    height: 16,
  },
  mediumSubNavWidth: (isTablet ? 270 : '100%') as CSS.DimensionValue,
  mediumWidth: (isTablet ? 460 : '100%') as CSS.DimensionValue,
  shortSubNavWidth: (isTablet ? 162 : '100%') as CSS.DimensionValue,
}

const util = isMobile ? utilNative : utilDesktop

export const globalStyles = {
  ...font,
  ...util,
}

// ─── Platform-specific style collections ──────────────────────────────────────

export const mobileStyles = {}
export const desktopStyles = isMobile
  ? {
      boxShadow: {},
      clickable: {},
      editable: {},
      fadeOpacity: {},
      noSelect: {},
      scrollable: {},
      windowDragging: {},
      windowDraggingClickable: {},
    }
  : {
      get boxShadow() {
        return {boxShadow: `0 2px 5px 0 ${themed.black_20OrBlack}`}
      },
      clickable: {cursor: 'pointer' as const},
      editable: {cursor: 'text' as const},
      fadeOpacity: {transition: 'opacity .25s ease-in-out' as const},
      noSelect: {userSelect: 'none' as const},
      scrollable: {overflowY: 'auto' as const},
      windowDragging: {
        // allow frameless window dragging
        WebkitAppRegion: 'drag' as const,
      },
      windowDraggingClickable: {
        // allow things in frameless regions to be clicked and not dragged
        WebkitAppRegion: 'no-drag' as const,
      },
    }

// ─── Transition helpers ───────────────────────────────────────────────────────

export const transition = (...properties: Array<string>) =>
  isMobile ? {} : {transition: properties.map(p => `${p} 0.1s ease-out`).join(', ')}

export const transitionColor = () => (isMobile ? {} : {transition: 'background 0.2s linear'})

// ─── Desktop initializer (DOM manipulation — desktop only) ────────────────────

export const initDesktopStyles = () => {
  if (isMobile) return
  const head = document.head
  const colorNames = Object.keys(colors).sort() as Array<keyof typeof colors>
  const colorVars = `
        :root { ${colorNames
          .reduce((s, name) => {
            const light = colors[name] as string
            const dark = darkColors[name] as string
            s.push(`--color-${name}: ${light === dark ? light : `light-dark(${light}, ${dark})`};`)
            return s
          }, new Array<string>())
          .join(' ')} }
`
  const helpers = colorNames.reduce((s, name) => {
    return (
      s +
      `.color_${name} {color: var(--color-${name});}\n` +
      `.color_${name}_important {color: var(--color-${name}) !important;}\n` +
      `.hover_color_${name}:hover:not(.spoiler .hover_color_${name}) {color: var(--color-${name});}\n` +
      `.hover_container:hover .hover_contained_color_${name}:not(.spoiler .hover_contained_color_${name}) {color: var(--color-${name}) !important;}\n` +
      `.background_color_${name} {background-color: var(--color-${name});}\n` +
      `.hover_background_color_${name}:hover:not(.spoiler .hover_background_color_${name}) {background-color: var(--color-${name});}\n`
    )
  }, '')
  const colorStyle = document.createElement('style')
  colorStyle.appendChild(document.createTextNode(colorVars))
  head.appendChild(colorStyle)

  const helperStyle = document.createElement('style')
  helperStyle.appendChild(document.createTextNode(helpers))
  head.appendChild(helperStyle)

  // Generate background-image CSS classes with dark mode variants
  const makeImgSet = (dir: string, name: string) => {
    const url = getAssetPath('images', dir, name)
    return `-webkit-image-set(url('${url}') 1x)`
  }
  const makeMultiResImgSet = (baseName: string) => {
    const ext = baseName.slice(baseName.lastIndexOf('.'))
    const base = baseName.slice(0, baseName.lastIndexOf('.'))
    const images = [1, 2, 3].map(
      mult => `url('${getAssetPath('images', base)}${mult === 1 ? '' : `@${mult}x`}${ext}') ${mult}x`
    )
    return `-webkit-image-set(${images.join(', ')})`
  }
  const imageCss =
    `.ashes-bg { background-image: ${makeImgSet('icons', 'pattern-ashes-desktop-400-68.png')}; }\n` +
    `@media (prefers-color-scheme: dark) { .ashes-bg { background-image: ${makeImgSet('icons', 'dark-pattern-ashes-desktop-400-68.png')}; } }\n` +
    `.upload-bg { background-image: ${makeMultiResImgSet('upload-pattern-80.png')}; }\n` +
    `@media (prefers-color-scheme: dark) { .upload-bg { background-image: ${makeMultiResImgSet('dark-upload-pattern-80.png')}; } }\n`
  const imageStyle = document.createElement('style')
  imageStyle.appendChild(document.createTextNode(imageCss))
  head.appendChild(imageStyle)

  // https://www.filamentgroup.com/lab/scrollbars/
  const parent = document.createElement('div')
  parent.setAttribute('style', 'width:30px;height:30px;')
  parent.classList.add('scrollbar-test')

  const child = document.createElement('div')
  child.setAttribute('style', 'width:100%;height:40px')
  parent.appendChild(child)
  document.body.appendChild(parent)

  // Measure the child element, if it is not
  // 30px wide the scrollbars are obtrusive.
  const scrollbarWidth = 30 - ((parent.firstChild as unknown as HTMLDivElement).clientWidth ?? 0)
  if (scrollbarWidth) {
    document.body.classList.add('layout-scrollbar-obtrusive')
  }

  document.body.removeChild(parent)
}

// ─── hairlineWidth ────────────────────────────────────────────────────────────

export const hairlineWidth = isMobile ? StyleSheet.hairlineWidth : 1

// ─── styleSheetCreate ─────────────────────────────────────────────────────────

type NamedStyles = Record<string, CSS._StylesCrossPlatform>
export function styleSheetCreate<const O extends NamedStyles>(styles: () => O): O
export function styleSheetCreate(styles: () => NamedStyles): NamedStyles {
  if (isMobile) {
    return styleSheetCreateProxy(styles, o => StyleSheet.create(o as unknown as Parameters<typeof StyleSheet.create>[0]) as MapToStyles) as unknown as NamedStyles
  }
  return styleSheetCreateProxy(styles, o => o) as NamedStyles
}

// ─── collapseStyles ───────────────────────────────────────────────────────────

export const collapseStyles = isMobile
  ? (styles: ReadonlyArray<unknown>): CSS.StylesCrossPlatform => {
      const nonNull = styles.filter(s => {
        if (!s) {
          return false
        }
        for (const _ in s as object) {
          return true
        }
        return false
      })
      if (!nonNull.length) {
        return undefined
      }
      if (nonNull.length === 1) {
        const s = nonNull[0]
        if (s && typeof s === 'object') {
          return s as CSS.StylesCrossPlatform
        }
      }
      return styles as CSS.StylesCrossPlatform
    }
  : (styles: ReadonlyArray<unknown>): CSS.StylesCrossPlatform => {
      // fast path for a single style that passes. Often we do stuff like
      // collapseStyle([styles.myStyle, this.props.something && {backgroundColor: 'red'}]), so in the false
      // case we can just take styles.myStyle and not render thrash
      const valid = styles.filter(s => {
        return !!s && Object.keys(s).length
      })
      if (valid.length === 0) {
        return undefined
      }
      if (valid.length === 1) {
        const s = valid[0]
        if (typeof s === 'object') {
          return s as CSS.StylesCrossPlatform
        }
      }

      // jenkins doesn't support flat yet
      const s = Object.assign({}, ...styles.flat()) as CSS.StylesCrossPlatform
      return s && Object.keys(s).length ? s : undefined
    }

// Desktop-specific version that always returns a plain object (for use with DOM style props).
export const collapseStylesDesktop = (styles: ReadonlyArray<unknown>): object | undefined => {
  const valid = styles.filter(s => {
    return !!s && Object.keys(s).length
  })
  if (valid.length === 0) {
    return undefined
  }
  if (valid.length === 1) {
    const s = valid[0]
    if (typeof s === 'object') {
      return s as object
    }
  }
  const s = Object.assign({}, ...styles.flat()) as object
  return Object.keys(s).length ? s : undefined
}

// ─── Platform constants ───────────────────────────────────────────────────────

export const borderRadius = isMobile ? 6 : 4
export const dimensionWidth = isMobile ? Dimensions.get('window').width : 0
export const dimensionHeight = isMobile ? Dimensions.get('window').height : 0
export const headerExtraHeight = isMobile ? (isTablet ? 16 : 0) : 0

// ─── Path utilities ───────────────────────────────────────────────────────────

export const normalizePath = (p: string) => {
  if (!isMobile) return p
  if (p.startsWith('/')) {
    return `file://${p}`
  }
  return p
}

export const unnormalizePath = (p: string) => {
  if (!isMobile) return p
  if (p.startsWith('file://')) {
    return p.slice('file://'.length)
  }
  return p
}

export const undynamicColor = (col: string): string => {
  if (!isMobile) return col
  const isDarkMode = useDarkModeState.getState().isDarkMode()
  const c = col as string | {dynamic?: {dark: string; light: string}}
  // try and unwrap, some things (toggle?) don't seem to like mixed dynamic colors
  if (typeof c !== 'string' && c.dynamic) {
    return c.dynamic[isDarkMode ? 'dark' : 'light']
  }
  return c as string
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export {isPhone, isTablet, fileUIName} from '@/constants/platform'
export * from './styles-base'
export {globalColors}
export {default as classNames} from './class-names'
export type StylesCrossPlatform = CSS.StylesCrossPlatform
export type {Color, CustomStyles, _StylesCrossPlatform, _StylesDesktop, _StylesMobile} from './css'
export type CollapsibleStyle = CSS.StylesCrossPlatform | false | '' | 0 | null | undefined
export type Position =
  | 'top left'
  | 'top right'
  | 'bottom right'
  | 'bottom left'
  | 'right center'
  | 'left center'
  | 'top center'
  | 'bottom center'
  | 'center center'
