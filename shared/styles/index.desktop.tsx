import * as React from 'react'
import * as Shared from './shared'
import styleSheetCreateProxy from './style-sheet-proxy'
import type * as CSS from './css'
import {isDarkMode} from './dark-mode'
import {themed, colors, darkColors} from './colors'
import {getAssetPath} from '../constants/platform.desktop'
import * as Path from '../util/path'

type _Elem = Object | null | false | void
// CollapsibleStyle is a generic version of ?StylesMobile and family,
// slightly extended to support "isFoo && myStyle".
type CollapsibleStyle = _Elem | ReadonlyArray<_Elem>

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
}

const font = {
  fontBold: {
    ...fontCommon,
    fontFamily: 'Keybase',
    fontWeight: 700,
  },
  fontExtrabold: {
    ...fontCommon,
    fontFamily: 'Keybase',
    fontWeight: 800,
  },
  fontNyctographic: {
    ...fontCommon,
    fontFamily: 'Nyctographic',
    fontWeight: 400,
  },
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Keybase',
    fontWeight: 500,
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'Keybase',
    fontWeight: 600,
  },
  fontTerminal: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
    fontWeight: 500,
  },
  fontTerminalSemibold: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
    fontWeight: 600,
  },
  italic: {
    fontStyle: 'italic',
  },
}

const util = {
  ...Shared.util,
  fastBackground: {backgroundColor: colors.transparent},
  largeWidthPercent: '70%',
  loadingTextStyle: {
    // this won't really work with dark mode
    backgroundColor: colors.greyLight,
    height: 16,
    marginBottom: Shared.globalMargins.tiny,
    marginTop: Shared.globalMargins.tiny,
  },
  mediumSubNavWidth: 260,
  mediumWidth: 400,
  shortSubNavWidth: 160,
}

export const globalStyles = {
  ...font,
  ...util,
}

export const mobileStyles = {}
export const desktopStyles = {
  get boxShadow() {
    return {boxShadow: `0 2px 5px 0 ${themed.black_20OrBlack}`}
  },
  clickable: {cursor: 'pointer'},
  editable: {cursor: 'text'},
  fadeOpacity: {transition: 'opacity .25s ease-in-out'},
  noSelect: {userSelect: 'none'},
  scrollable: {overflowY: 'auto'},
  windowDragging: {
    // allow frameless window dragging
    WebkitAppRegion: 'drag',
  },
  windowDraggingClickable: {
    // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag',
  },
}

export const transition = (...properties: Array<string>) => ({
  transition: properties.map(p => `${p} 0.1s ease-out`).join(', '),
})

export const transitionColor = () => ({
  transition: 'background 0.2s linear',
})

export const backgroundURL = (...to: Array<string>) => {
  const goodPath = [...to]

  if (goodPath && goodPath.length) {
    const last = goodPath[goodPath.length - 1]
    const ext = Path.extname(last)
    goodPath[goodPath.length - 1] = Path.basename(last, ext)
    const guiModePath = `${isDarkMode() ? 'dark-' : ''}${goodPath}`
    const images = [1, 2, 3].map(
      mult => `url('${getAssetPath('images', guiModePath)}${mult === 1 ? '' : `@${mult}x`}${ext}') ${mult}x`
    )
    return `-webkit-image-set(${images.join(', ')})`
  }

  return ''
}

const fixScrollbars = () => {
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
  // @ts-ignore
  const scrollbarWidth = 30 - parent.firstChild.clientWidth
  if (scrollbarWidth) {
    document.body.classList.add('layout-scrollbar-obtrusive')
  }

  document.body.removeChild(parent)
}

export const initDesktopStyles = () => {
  const head = document.head
  if (!head) {
    console.error('initDesktopStyles failed')
    return
  }
  const style = document.createElement('style')
  style.type = 'text/css'
  const css = Object.keys(colors).reduce((s, name) => {
    const color = colors[name]
    const darkColor = darkColors[name]
    if (color) {
      return (
        s +
        `.color_${name} {color: ${color};}\n` +
        `.darkMode .color_${name} {color: ${darkColor};}\n` +
        `.hover_color_${name}:hover {color: ${color};}\n` +
        `.darkMode .hover_color_${name}:hover {color: ${darkColor};}\n` +
        `.hover_container:hover .hover_contained_color_${name} {color: ${color} !important;}\n` +
        `.darkMode .hover_container:hover .hover_contained_color_${name} {color: ${darkColor} !important;}\n` +
        `.background_color_${name} {background-color: ${color};}\n` +
        `.darkMode .background_color_${name} {background-color: ${darkColor};}\n` +
        `.hover_background_color_${name}:hover {background-color: ${color};}\n` +
        `.darkMode .hover_background_color_${name}:hover {background-color: ${darkColor};}\n`
      )
    } else {
      return s
    }
  }, '')
  style.appendChild(document.createTextNode(css))
  head.appendChild(style)
  fixScrollbars()
}

export const hairlineWidth = 1
export const styleSheetCreate = (obj: any) => styleSheetCreateProxy(obj, o => o)
export const collapseStyles = (styles: ReadonlyArray<CollapsibleStyle>): Object | undefined => {
  // fast path for a single style that passes. Often we do stuff like
  // collapseStyle([styles.myStyle, this.props.something && {backgroundColor: 'red'}]), so in the false
  // case we can just take styles.myStyle and not render thrash
  const valid = styles.filter(s => {
    return !!s && Object.keys(s).length
  })
  if (valid.length === 0) {
    return undefined as any
  }
  if (valid.length === 1) {
    const s = valid[0]
    if (typeof s === 'object') {
      return s as Object
    }
  }

  // jenkins doesn't support flat yet
  let s: Object
  if (__STORYSHOT__) {
    const flat = styles.reduce((a: Array<CollapsibleStyle>, e: CollapsibleStyle) => a.concat(e), []) as Array<
      Object | null | false
    >
    s = Object.assign({}, ...flat)
  } else {
    s = Object.assign({}, ...styles.flat())
  }
  return Object.keys(s).length ? s : undefined
}
export {isMobile, isPhone, isTablet, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {
  globalMargins,
  backgroundModeToColor,
  backgroundModeToTextColor,
  platformStyles,
  padding,
} from './shared'

// @ts-ignore
export {keyframes as styledKeyframes} from '@emotion/react'
// @ts-ignore
export {default as styled} from '@emotion/styled'
export {themed as globalColors} from './colors'
export const statusBarHeight = 0
export const borderRadius = 4
export {default as classNames} from 'classnames'
export type StylesCrossPlatform = CSS.StylesCrossPlatform
export const dimensionWidth = 0
export const dimensionHeight = 0
export {isDarkMode, DarkModeContext} from './dark-mode'
export const headerExtraHeight = 0
export const CanFixOverdrawContext = React.createContext(false)
export const dontFixOverdraw = {canFixOverdraw: false}
export const yesFixOverdraw = {canFixOverdraw: true}
export const undynamicColor = (col: any) => col
