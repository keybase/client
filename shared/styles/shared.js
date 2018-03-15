// @flow
import globalColors from './colors'
import * as Platform from '../constants/platform'
import type {_StylesCrossPlatform, _StylesMobile, _StylesDesktop} from './css'

export const globalMargins = {
  xtiny: 4,
  tiny: 8,
  small: 16,
  medium: 24,
  large: 40,
  xlarge: 64,
}

export const backgroundModeToColor = {
  Announcements: globalColors.blue,
  Documentation: globalColors.darkBlue,
  HighRisk: globalColors.red,
  Information: globalColors.yellow,
  Normal: globalColors.white,
  Success: globalColors.green,
  Terminal: globalColors.darkBlue3,
}

export const util = ({flexCommon}: {flexCommon?: ?Object}) => ({
  fillAbsolute: {bottom: 0, left: 0, position: 'absolute', right: 0, top: 0},
  flexBoxCenter: {...flexCommon, alignItems: 'center', justifyContent: 'center'},
  flexBoxColumn: {...flexCommon, flexDirection: 'column'},
  flexBoxRow: {...flexCommon, flexDirection: 'row'},
  flexGrow: {flexGrow: 1},
  fullHeight: {height: '100%'},
  rounded: {borderRadius: 3},
})

// Take common styles and make them work on both. Deals with special cases in lineHeight and etc
const unifyStyles = s => ({
  ...s,
  ...(s.hasOwnProperty('lineHeight') && typeof s.lineHeight === 'number'
    ? {lineHeight: Platform.isMobile ? s.lineHeight : s.lineHeight === 0 ? '0' : `${s.lineHeight}px`}
    : {}),
})

export const platformStyles = (options: {|
  common?: ?_StylesCrossPlatform,
  isIOS?: _StylesMobile,
  isAndroid?: _StylesMobile,
  isMobile?: _StylesMobile,
  isElectron?: _StylesDesktop,
|}) => ({
  ...(options.common ? unifyStyles(options.common) : {}),
  ...(Platform.isIOS && options.isIOS ? options.isIOS : {}),
  ...(Platform.isAndroid && options.isAndroid ? options.isAndroid : {}),
  ...(Platform.isMobile && options.isMobile ? options.isMobile : {}),
  ...(Platform.isElectron && options.isElectron ? unifyStyles(options.isElectron) : {}),
})
