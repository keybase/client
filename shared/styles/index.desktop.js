// @flow
import globalColors from './colors'
import {resolveImageAsURL} from '../desktop/resolve-root'
import path from 'path'
import isArray from 'lodash/isArray'
import * as Shared from './shared'

export const windowStyle = {
  height: 600, // Default height
  minHeight: 400,
  minWidth: 600,
  width: 800, // Default width
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
}

const font = {
  fontBold: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: '700',
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
  scrollable: {overflowY: 'auto'},
}

export const globalStyles = {
  ...font,
  ...util,
}

export const mobileStyles = {}
export const desktopStyles = {
  clickable: {cursor: 'pointer'},
  fadeOpacity: {transition: 'opacity .25s ease-in-out'},
  noSelect: {userSelect: 'none'},
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

export const hairlineWidth = 1
export const styleSheetCreate = (obj: Object) => obj
export const collapseStyles = (styles: Array<Object> | Object) => {
  if (isArray) {
    return styles.reduce((map, item) => {
      return {...map, ...item}
    }, {})
  } else {
    return styles
  }
}
export {isMobile, fileUIName, isIPhoneX} from '../constants/platform'
export {globalMargins, backgroundModeToColor, platformStyles} from './shared'
export {default as glamorous} from 'glamorous'
export {default as globalColors} from './colors'
