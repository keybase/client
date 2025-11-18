import {themed as globalColors} from './colors'
import type {_StylesCrossPlatform, _StylesMobile, _StylesDesktop} from './css'
import type {Background} from '@/common-adapters/text'

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

const flexCommon = C.isMobile ? {} : ({display: 'flex'} as const)
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
function unifyStyles<T extends {[key: string]: unknown}>(s: T): Unified<T> {
  // only mutate this if we need to
  if (!C.isMobile && Object.hasOwn(s, 'lineHeight') && typeof s['lineHeight'] === 'number') {
    return {
      ...s,
      lineHeight: s['lineHeight'] === 0 ? '0' : `${s['lineHeight']}px`,
    } as Unified<T>
  }
  return s as Unified<T>
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
//     C.isMobile?: any
//     C.isPhone?: any
//     C.isTablet?: any
//     C.isIOS?: any
//     C.isAndroid?: any
//     C.isElectron?: any
//   },
//   C = T extends {common: infer J} ? J : never,
//   M = T extends {C.isMobile: infer J} ? J : never,
//   P = T extends {C.isPhone: infer J} ? J : never,
//   Tab = T extends {C.isTablet: infer J} ? J : never,
//   A = T extends {C.isAndroid: infer J} ? J : never,
//   I = T extends {C.isIOS: infer J} ? J : never,
//   E = T extends {C.isElectron: infer J} ? J : never,
//   Elec = Util.Assign<AsObj<C>, AsObj<E>>,
//   Mob = Util.Assign<
//     Util.Assign<Util.Assign<Util.Assign<Util.Assign<AsObj<C>, AsObj<I>>, AsObj<M>>, AsObj<P>>, AsObj<Tab>>,
//     AsObj<A>
//   >,
//   OUT = Both<Elec, Mob>
// >(o: T): OUT {
//   return {
//     ...(o.common ? unifyStyles(o.common) : {}),
//     ...(C.isMobile && o.C.isMobile ? o.C.isMobile : {}),
//     ...(C.isIOS && o.C.isIOS ? o.C.isIOS : {}),
//     ...(C.isAndroid && o.C.isAndroid ? o.C.isAndroid : {}),
//     ...(C.isPhone && o.C.isPhone ? o.C.isPhone : {}),
//     ...(C.isTablet && o.C.isTablet ? o.C.isTablet : {}),
//     ...(C.isElectron && o.C.isElectron ? unifyStyles(o.C.isElectron) : {}),
//   } as OUT
// }

const nostyle = {} as const
export function platformStyles<
  T extends {
    common?: _StylesCrossPlatform
    C.isMobile?: _StylesMobile
    C.isPhone?: _StylesMobile
    C.isTablet?: _StylesMobile
    C.isIOS?: _StylesMobile
    C.isAndroid?: _StylesMobile
    C.isElectron?: _StylesDesktop
  },
  OUT = _StylesCrossPlatform,
>(o: T): OUT {
  const ss = [
    ...(o.common ? [unifyStyles(o.common)] : []),
    ...(C.isMobile && o.C.isMobile ? [o.C.isMobile] : []),
    ...(C.isIOS && o.C.isIOS ? [o.C.isIOS] : []),
    ...(C.isAndroid && o.C.isAndroid ? [o.C.isAndroid] : []),
    ...(C.isPhone && o.C.isPhone ? [o.C.isPhone] : []),
    ...(C.isTablet && o.C.isTablet ? [o.C.isTablet] : []),
    ...(C.isElectron && o.C.isElectron ? [unifyStyles(o.C.isElectron)] : []),
  ]
  const fss = ss.filter(Boolean)
  if (fss.length === 0) {
    return nostyle as OUT
  }
  // special common case for just per platform styles
  if (fss.length === 1) {
    const out = fss[0] as OUT
    return out
  }

  const out = Object.assign({}, ...fss) as OUT
  return out
}

/* eslint-disable sort-keys */
export const padding = (top: number, right?: number, bottom?: number, left?: number) => ({
  paddingTop: top,
  paddingRight: right !== undefined ? right : top,
  paddingBottom: bottom !== undefined ? bottom : top,
  paddingLeft: left !== undefined ? left : right !== undefined ? right : top,
})
/* eslint-enable sort-keys */
