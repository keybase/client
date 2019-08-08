import {colors, darkColors} from './colors'
import {resolveImageAsURL} from '../desktop/app/resolve-root.desktop'
import path from 'path'
import * as Shared from './shared'
import {isEmpty} from 'lodash-es'
import styleSheeCreateProxy from './style-sheet-proxy'
import * as CSS from './css'

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
  ...Shared.util({flexCommon: {display: 'flex'}}),
  loadingTextStyle: {
    // this won't really work with dark mode
    backgroundColor: colors.greyLight,
    height: 16,
    marginBottom: Shared.globalMargins.tiny,
    marginTop: Shared.globalMargins.tiny,
  },
}

export const globalStyles = {
  ...font,
  ...util,
}

export const mobileStyles = {}
export const desktopStyles = {
  boxShadow: {boxShadow: `0 2px 5px 0 ${colors.black_20}`},
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
    const ext = path.extname(last)
    goodPath[goodPath.length - 1] = path.basename(last, ext)

    const images = [1, 2, 3].map(
      mult => `url('${resolveImageAsURL(...goodPath)}${mult === 1 ? '' : `@${mult}x`}${ext}') ${mult}x`
    )

    return `-webkit-image-set(${images.join(', ')})`
  }

  return ''
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
        `.hover_container:hover .hover_contained_color_${name} {color: ${color};}\n` +
        `.darkMode .hover_container:hover .hover_contained_color_${name} {color: ${darkColor};}\n` +
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
}

export const hairlineWidth = 1
export const styleSheetCreate = (obj: Object) => styleSheeCreateProxy(obj, o => o)
export const collapseStyles = (styles: ReadonlyArray<CollapsibleStyle>): Object | undefined => {
  // fast path for a single style that passes. Often we do stuff like
  // collapseStyle([styles.myStyle, this.props.something && {backgroundColor: 'red'}]), so in the false
  // case we can just take styles.myStyle and not render thrash
  const valid = styles.filter(Boolean)
  if (valid.length === 1) {
    const s = valid[0]
    if (typeof s === 'object') {
      return s as Object
    }
  }

  const flattenedStyles = styles.reduce(
    (a: Array<CollapsibleStyle>, e: CollapsibleStyle) => a.concat(e),
    []
  ) as Array<Object | null | false>
  const style = flattenedStyles.reduce<Object>((o, e) => Object.assign(o, e), {})
  return isEmpty(style) ? undefined : style
}
export {isMobile, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {
  globalMargins,
  backgroundModeToColor,
  backgroundModeToTextColor,
  platformStyles,
  padding,
} from './shared'

export {css as styledCss, keyframes as styledKeyframes} from '@emotion/core'
export {default as styled} from '@emotion/styled'
export {themed as globalColors} from './colors'
export const statusBarHeight = 0
export const borderRadius = 4
export {default as classNames} from 'classnames'
export type StylesCrossPlatform = CSS.StylesCrossPlatform
export const dimensionWidth = 0
export const dimensionHeight = 0
export {isDarkMode} from './dark-mode'
