// @flow
import globalColors from './colors'
import {resolveImageAsURL} from '../desktop/app/resolve-root.desktop'
import path from 'path'
import {type CollapsibleStyle} from './index.types'
import * as Shared from './shared'

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
}

const font = {
  fontBold: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: 700,
  },
  fontExtrabold: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: 800,
  },
  fontRegular: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: 400,
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: 600,
  },
  fontTerminal: {
    ...fontCommon,
    fontFamily: 'Source Code Pro',
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
    backgroundColor: globalColors.lightGrey,
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
  const css = Object.keys(globalColors).reduce((s, name) => {
    const color = globalColors[name]
    if (color) {
      return (
        s +
        `.color_${name} {color: ${color};}\n` +
        `.hover_color_${name}:hover {color: ${color};}\n` +
        `.background_color_${name} {background-color: ${color};}\n` +
        `.hover_background_color_${name}:hover {background-color: ${color};}\n`
      )
    } else {
      return s
    }
  }, '')
  style.appendChild(document.createTextNode(css))
  head.appendChild(style)
}

export const hairlineWidth = 1
export const styleSheetCreate = (obj: Object) => obj
export const collapseStyles = (styles: $ReadOnlyArray<CollapsibleStyle>): Object => {
  // fast path for a single style that passes. Often we do stuff like
  // collapseStyle([styles.myStyle, this.props.something && {backgroundColor: 'red'}]), so in the false
  // case we can just take styles.myStyle and not render thrash
  const valid = styles.filter(Boolean)
  if (valid.length === 1) {
    const s = valid[0]
    if (typeof s === 'object') {
      // $ForceType
      return s
    }
  }

  const flattenedStyles = styles.reduce((a, e) => a.concat(e), [])
  return flattenedStyles.reduce((o, e) => (e ? {...o, ...e} : o), {})
}
export {isMobile, fileUIName, isIPhoneX, isIOS, isAndroid} from '../constants/platform'
export {globalMargins, backgroundModeToColor, platformStyles} from './shared'
export {default as glamorous} from 'glamorous'
export {default as globalColors} from './colors'
export const statusBarHeight = 0
export const borderRadius = 4
export {default as classNames} from 'classnames'
export type {StylesCrossPlatform} from './index.types'
