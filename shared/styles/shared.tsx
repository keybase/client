import {themed as globalColors} from './colors'
import {isMobile, isIOS, isAndroid, isTablet, isPhone, isElectron} from '../constants/platform'
import {_StylesCrossPlatform, _StylesMobile, _StylesDesktop} from './css'
import {Background} from '../common-adapters/text'

/* eslint-disable sort-keys */
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
/* eslint-enable sort-keys */

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
export const util = {
  fillAbsolute: {bottom: 0, left: 0, position: 'absolute', right: 0, top: 0},
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

// Take common styles and make them work on both. Deals with special cases in lineHeight and etc
const unifyStyles = (s: any) => ({
  ...s,
  ...(Object.prototype.hasOwnProperty.call(s, 'lineHeight') && typeof s.lineHeight === 'number'
    ? {lineHeight: isMobile ? s.lineHeight : s.lineHeight === 0 ? '0' : `${s.lineHeight}px`}
    : {}),
})

type AsStylesCrossPlatform<T> = {
  [P in keyof T]: P extends keyof _StylesCrossPlatform
    ? T[P] extends _StylesCrossPlatform[P]
      ? T[P]
      : _StylesCrossPlatform[P]
    : T[P]
}

export function platformStyles<
  Ret extends C & I & A & M & E,
  C extends _StylesCrossPlatform = {},
  M extends _StylesMobile = {},
  P extends _StylesMobile = {},
  T extends _StylesMobile = {},
  I extends _StylesMobile = {},
  A extends _StylesMobile = {},
  E extends _StylesDesktop = {}
>(options: {common?: C; isMobile?: M; isPhone?: P; isTablet?: T; isIOS?: I; isAndroid?: A; isElectron?: E}) {
  return ({
    ...(options.common ? unifyStyles(options.common) : {}),
    ...(isMobile && options.isMobile ? options.isMobile : {}),
    ...(isIOS && options.isIOS ? options.isIOS : {}),
    ...(isAndroid && options.isAndroid ? options.isAndroid : {}),
    ...(isPhone && options.isPhone ? options.isPhone : {}),
    ...(isTablet && options.isTablet ? options.isTablet : {}),
    ...(isElectron && options.isElectron ? unifyStyles(options.isElectron) : {}),
  } as any) as AsStylesCrossPlatform<Ret>
}

/* eslint-disable sort-keys */
export const padding = (top: number, right?: number, bottom?: number, left?: number) => ({
  paddingTop: top,
  paddingRight: right !== undefined ? right : top,
  paddingBottom: bottom !== undefined ? bottom : top,
  paddingLeft: left !== undefined ? left : right !== undefined ? right : top,
})
/* eslint-enable sort-keys */
