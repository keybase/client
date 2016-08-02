/* @flow */
// Styles from our designers

import globalColors from './style-guide-colors'
import {resolveImageAsURL} from '../../desktop/resolve-root'
import path from 'path'
export {default as globalColors} from './style-guide-colors'

export const windowStyle = {
  minWidth: 800,
  minHeight: 600,
  width: 800, // Default width
  height: 600, // Default height
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
  letterSpacing: '0.3px',
}

const font = {
  fontRegular: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 400,
  },
  fontSemibold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 600,
  },
  fontBold: {
    ...fontCommon,
    fontFamily: 'Lato',
    fontWeight: 700,
  },
  italic: {
    fontStyle: 'italic',
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
}

const flexBoxCommon = {
  display: 'flex',
}

export const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 32,
  large: 48,
  xlarge: 64,
}

const util = {
  flexBoxColumn: {
    ...flexBoxCommon,
    flexDirection: 'column',
  },
  flexBoxRow: {
    ...flexBoxCommon,
    flexDirection: 'row',
  },
  flexBoxCenter: {
    ...flexBoxCommon,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollable: {
    overflowY: 'auto',
  },
  selectable: {
    WebkitUserSelect: 'initial',
  },
  noSelect: {
    WebkitUserSelect: 'none',
  },
  windowDragging: { // allow frameless window dragging
    WebkitAppRegion: 'drag',
  },
  windowDraggingClickable: { // allow things in frameless regions to be clicked and not dragged
    WebkitAppRegion: 'no-drag',
  },
  rounded: {
    borderRadius: 3,
  },
  clickable: {
    cursor: 'pointer',
  },
  topMost: {
    zIndex: 9999,
  },
  textDecoration: (type: string) => ({
    textDecoration: type,
  }),
  loadingTextStyle: {
    backgroundColor: globalColors.lightGrey,
    height: 16,
    marginTop: globalMargins.tiny,
    marginBottom: globalMargins.tiny,
  },
  fadeOpacity: {
    transition: 'opacity .25s ease-in-out',
  },
}

export const globalStyles = {
  ...font,
  ...util,
}

export function transition (...properties: Array<string>) : Object {
  return {
    transition: properties.map(p => `${p} 0.2s ease-out`).join(', '),
  }
}

export function transitionColor () : Object {
  return {
    transition: 'background 0.2s linear',
  }
}

export function backgroundURL (...to: Array<string>): string {
  const goodPath = [...to]

  if (goodPath && goodPath.length) {
    const last = goodPath[goodPath.length - 1]
    const ext = path.extname(last)
    goodPath[goodPath.length - 1] = path.basename(last, ext)

    const images = [1, 2, 3].map(mult => `url('${resolveImageAsURL(...goodPath)}${mult === 1 ? '' : `@${mult}x`}${ext}') ${mult}x`)

    return `-webkit-image-set(${images.join(', ')})`
  }

  return ''
}
