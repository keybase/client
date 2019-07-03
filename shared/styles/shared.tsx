import globalColors from './colors'
import {isMobile, isIOS, isAndroid, isElectron} from '../constants/platform'
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
}
/* eslint-enable sort-keys */

export const backgroundModeToColor = {
  Announcements: globalColors.blue,
  Documentation: globalColors.blueDarker,
  HighRisk: globalColors.red,
  Information: globalColors.yellow,
  Normal: globalColors.white,
  Success: globalColors.green,
  Terminal: globalColors.blueDarker2,
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

export const util = ({flexCommon}: {flexCommon?: Object | null}) => ({
  fillAbsolute: {bottom: 0, left: 0, position: 'absolute', right: 0, top: 0},
  flexBoxCenter: {...flexCommon, alignItems: 'center', justifyContent: 'center'},
  flexBoxColumn: {...flexCommon, flexDirection: 'column'},
  flexBoxColumnReverse: {...flexCommon, flexDirection: 'column-reverse'},
  flexBoxRow: {...flexCommon, flexDirection: 'row'},
  flexBoxRowReverse: {...flexCommon, flexDirection: 'row-reverse'},
  flexGrow: {flexGrow: 1},
  flexOne: {flex: 1},
  fullHeight: {height: '100%'},
  fullWidth: {width: '100%'},
  rounded: {borderRadius: 3},
})

// Take common styles and make them work on both. Deals with special cases in lineHeight and etc
const unifyStyles = (s: any) => ({
  ...s,
  ...(Object.prototype.hasOwnProperty.call(s, 'lineHeight') && typeof s.lineHeight === 'number'
    ? {lineHeight: isMobile ? s.lineHeight : s.lineHeight === 0 ? '0' : `${s.lineHeight}px`}
    : {}),
})

export const platformStyles = (options: {
  common?: _StylesCrossPlatform | null
  isIOS?: _StylesMobile
  isAndroid?: _StylesMobile
  isMobile?: _StylesMobile
  isElectron?: _StylesDesktop
}) => ({
  ...(options.common ? unifyStyles(options.common) : {}),
  ...(isMobile && options.isMobile ? options.isMobile : {}),
  ...(isIOS && options.isIOS ? options.isIOS : {}),
  ...(isAndroid && options.isAndroid ? options.isAndroid : {}),
  ...(isElectron && options.isElectron ? unifyStyles(options.isElectron) : {}),
})

/* eslint-disable sort-keys */
export const padding = (top: number, right?: number, bottom?: number, left?: number) => ({
  paddingTop: top,
  paddingRight: right !== undefined ? right : top,
  paddingBottom: bottom !== undefined ? bottom : top,
  paddingLeft: left !== undefined ? left : right !== undefined ? right : top,
})
/* eslint-enable sort-keys */
