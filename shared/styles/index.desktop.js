// @flow
// Styles from our designers
import globalColors from './colors'
import {resolveImageAsURL} from '../desktop/resolve-root'
import path from 'path'

const windowStyle = {
  minWidth: 600,
  minHeight: 400,
  width: 800, // Default width
  height: 600, // Default height
}

const fontCommon = {
  WebkitFontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
}

const font = {
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
  fontBold: {
    ...fontCommon,
    fontFamily: 'OpenSans',
    fontWeight: '700',
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

const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 24,
  large: 40,
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
  fillAbsolute: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
  },
  scrollable: {
    overflowY: 'auto',
  },
  selectable: {
    WebkitUserSelect: 'text',
    cursor: 'text',
  },
  noSelect: {
    WebkitUserSelect: 'none',
  },
  windowDragging: {
    // allow frameless window dragging
    WebkitAppRegion: 'drag',
  },
  windowDraggingClickable: {
    // allow things in frameless regions to be clicked and not dragged
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

const globalStyles = {
  ...font,
  ...util,
  italic: {
    fontStyle: 'italic',
  },
}

function transition(...properties: Array<string>): Object {
  return {
    transition: properties.map(p => `${p} 0.1s ease-out`).join(', '),
  }
}

function transitionColor(): Object {
  return {
    transition: 'background 0.2s linear',
  }
}

function backgroundURL(...to: Array<string>): string {
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

export {backgroundURL, transitionColor, transition, globalStyles, globalMargins, windowStyle, globalColors}
