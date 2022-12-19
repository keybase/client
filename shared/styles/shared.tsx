import {themed as globalColors} from './colors'
import {isMobile, isIOS, isAndroid, isTablet, isPhone, isElectron} from '../constants/platform'
import type {_StylesCrossPlatform, _StylesMobile, _StylesDesktop} from './css'
import type {Background} from '../common-adapters/text'

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
type Unified<T> = {
  [P in keyof T]: P extends 'lineHeight' ? _StylesCrossPlatform[P] : T[P]
}
function unifyStyles<T extends {}>(s_: T): Unified<T> {
  const s: any = s_
  return {
    ...s,
    ...(Object.prototype.hasOwnProperty.call(s, 'lineHeight') && typeof s.lineHeight === 'number'
      ? {lineHeight: isMobile ? s.lineHeight : s.lineHeight === 0 ? '0' : `${s.lineHeight}px`}
      : {}),
  }
}

// This is a better literal to literal inferrer but is too slow
// type Both<X, Y> = {
//   [P in keyof X | keyof Y]: P extends keyof X
//     ? P extends keyof Y
//       ? X[P] | Y[P] // both
//       : X[P]
//     : P extends keyof Y
//     ? Y[P]
//     : undefined
// }
// type AsObj<T> = T extends object ? T : never

// export function platformStyles<
//   T extends {
//     common: any
//     isMobile?: any
//     isPhone?: any
//     isTablet?: any
//     isIOS?: any
//     isAndroid?: any
//     isElectron?: any
//   },
//   C = T extends {common: infer J} ? J : never,
//   M = T extends {isMobile: infer J} ? J : never,
//   P = T extends {isPhone: infer J} ? J : never,
//   Tab = T extends {isTablet: infer J} ? J : never,
//   A = T extends {isAndroid: infer J} ? J : never,
//   I = T extends {isIOS: infer J} ? J : never,
//   E = T extends {isElectron: infer J} ? J : never,
//   Elec = Util.Assign<AsObj<C>, AsObj<E>>,
//   Mob = Util.Assign<
//     Util.Assign<Util.Assign<Util.Assign<Util.Assign<AsObj<C>, AsObj<I>>, AsObj<M>>, AsObj<P>>, AsObj<Tab>>,
//     AsObj<A>
//   >,
//   OUT = Both<Elec, Mob>
// >(o: T): OUT {
//   return {
//     ...(o.common ? unifyStyles(o.common) : {}),
//     ...(isMobile && o.isMobile ? o.isMobile : {}),
//     ...(isIOS && o.isIOS ? o.isIOS : {}),
//     ...(isAndroid && o.isAndroid ? o.isAndroid : {}),
//     ...(isPhone && o.isPhone ? o.isPhone : {}),
//     ...(isTablet && o.isTablet ? o.isTablet : {}),
//     ...(isElectron && o.isElectron ? unifyStyles(o.isElectron) : {}),
//   } as OUT
// }

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
  OUT = _StylesCrossPlatform
>(o: T): OUT {
  return {
    ...(o.common ? unifyStyles(o.common) : {}),
    ...(isMobile && o.isMobile ? o.isMobile : {}),
    ...(isIOS && o.isIOS ? o.isIOS : {}),
    ...(isAndroid && o.isAndroid ? o.isAndroid : {}),
    ...(isPhone && o.isPhone ? o.isPhone : {}),
    ...(isTablet && o.isTablet ? o.isTablet : {}),
    ...(isElectron && o.isElectron ? unifyStyles(o.isElectron) : {}),
  } as OUT
}

/* eslint-disable sort-keys */
export const padding = (top: number, right?: number, bottom?: number, left?: number) => ({
  paddingTop: top,
  paddingRight: right !== undefined ? right : top,
  paddingBottom: bottom !== undefined ? bottom : top,
  paddingLeft: left !== undefined ? left : right !== undefined ? right : top,
})
/* eslint-enable sort-keys */
