// the _on_white are precomputed colors so we can do less blending on mobile
import {isDarkMode, isDarkModePreference} from './dark-mode'
import {partyMode} from '../local-debug'
import {isIOS} from '../constants/platform'

export const colors = {
  black: 'rgba(0, 0, 0, 0.85)',
  get blackOrBlack() {
    return this.black
  },
  get blackOrWhite() {
    return this.black
  },
  black_05: 'rgba(0, 0, 0, 0.05)',
  get black_05OrBlack_60() {
    return this.black_05
  },
  get black_05OrWhite_10() {
    return this.black_05
  },
  black_05_on_white: 'rgb(242,242,242)',
  black_10: 'rgba(0, 0, 0, 0.10)',
  get black_10OrBlack() {
    return this.black_10
  },
  black_10_on_white: 'rgb(229,229,229)',
  black_20: 'rgba(0, 0, 0, 0.20)',
  get black_20OrBlack() {
    return this.black_20
  },
  get black_20OrWhite_20() {
    return this.black_20
  },
  black_20_on_white: 'rgb(204,204,204)',
  black_35: 'rgba(0, 0, 0, 0.35)',
  black_40: 'rgba(0, 0, 0, 0.40)',
  black_50: 'rgba(0, 0, 0, 0.50)',
  get black_50OrBlack_40() {
    return this.black_50
  },
  get black_50OrBlack_50() {
    return this.black_50
  },
  get black_50OrBlack_60() {
    return this.black_50
  },
  get black_50OrWhite() {
    return this.black_50
  },
  get black_50OrWhite_40() {
    return this.black_50
  },
  get black_50OrWhite_75() {
    return this.black_50
  },
  black_50_on_white: 'rgb(127,127,127)',
  black_60: 'rgba(0, 0, 0, 0.60)',
  black_63: 'rgba(0, 0, 0, 0.63)',
  black_on_white: 'rgb(38,38,38)',
  blue: '#4C8EFF',
  blueDark: '#3663EA',
  get blueDarkOrBlueLight() {
    return this.blueDark
  },
  get blueDarkOrGreyDarkest() {
    return this.blueDark
  },
  blueDarker: '#1036AC',
  blueDarker2: '#182D6E',
  blueDarker2_75: 'rgba(24, 45, 110, .75)',
  blueDarker2_75_on_white: 'rgb(82,98,147)',
  get blueDarkerOrBlack() {
    return this.blueDarker
  },
  get blueDarkerOrBlack_60() {
    return this.blueDarker
  },
  get blueDarkerOrBlack_85() {
    return this.blueDarker
  },
  blueGrey: '#F2F4F7',
  blueGreyDark: '#E0E8F6',
  blueGreyLight: '#F9F9FA',
  blueLight: '#73A6FF',
  blueLighter: '#A8CCFF',
  blueLighter2: '#EBF2FC',
  blueLighter3: '#F7F9FC',
  get blueLighterOrBlack_50() {
    return this.blueLighter
  },
  get blueLighterOrBlueDarker() {
    return this.blueLighter
  },
  get blueLighterOrBlueLight() {
    return this.blueLighter
  },
  get blueLighterOrWhite() {
    return this.blueLighter
  },
  blueLighter_20: 'rgba(168, 204, 255, 0.2)',
  blueLighter_20_on_white: 'rgb(238, 245, 255)',
  blueLighter_40: 'rgba(168, 204, 255, 0.4)',
  blueLighter_40_on_white: 'rgb(220, 235, 255)',
  blueLighter_60: 'rgba(168, 204, 255, 0.6)',
  blueLighter_60_on_white: 'rgb(203, 224, 255)',
  blue_10: 'rgba(51, 160, 255, 0.1)',
  blue_30: 'rgba(51, 160, 255, 0.3)',
  blue_30_on_white: 'rgb(192,226,255)',
  blue_60: 'rgba(51, 160, 255, 0.6)',
  blue_60_on_white: 'rgb(133,198,255)',
  brown: 'rgb(71, 31, 17)',
  brown_75: 'rgba(71, 31, 17, 0.75)',
  get brown_75OrYellow() {
    return this.brown_75
  },
  brown_75_on_white: 'rgb(117,87,78)',
  fastBlank: isIOS ? '#FFFFFF' : undefined, // on iOS overdraw is eliminated if we use white, on Android it's eliminated if it's undefined /shrug
  green: '#37BD99',
  greenDark: '#189e7a',
  get greenDarkOrBlack() {
    return this.greenDark
  },
  get greenDarkOrWhite() {
    return this.greenDark
  },
  greenDarker: '#12785d',
  greenLight: '#B7EED9',
  get greenLightOrWhite() {
    return this.greenLight
  },
  greenLighter: '#E8FAF6',
  get greenLighterOrGreen() {
    return this.greenLighter
  },
  get greenLighterOrGreenDark() {
    return this.greenLighter
  },
  get greenOrGreenLighter() {
    return this.greenLighter
  },
  grey: '#e6e6e6',
  greyDark: '#cccccc',
  greyDarker: '#aaaaaa',
  greyDarkest: '#2d2d2d',
  greyLight: '#f0f0f0',
  orange: '#ff6f21',
  orange_90: 'rgba(255, 111, 33, 0.9)',
  purple: '#8852ff',
  purpleDark: '#6d3fd1',
  get purpleDarkOrWhite() {
    return this.purpleDark
  },
  purpleDarker: '#5128a8',
  purpleLight: '#9d70ff',
  purpleLighter: '#E8DEFF',
  get purpleOrWhite() {
    return this.purple
  },
  purple_01: 'rgba(132, 82, 255, 0.01)',
  purple_10: 'rgba(132, 82, 255, 0.1)',
  get purple_10OrPurple() {
    return this.purple_10
  },
  purple_30: 'rgba(132, 82, 255, 0.3)',
  purple_40: 'rgba(132, 82, 255, 0.4)',
  red: '#ff4d61',
  redDark: '#eb253b',
  get redDarkOrWhite() {
    return this.redDark
  },
  redDarker: '#bd0b1f',
  redLight: '#FFCAC1',
  redLighter: '#FAF2ED',
  red_10: 'rgba(255,0,0,0.1)',
  get red_10OrRed() {
    return this.red_10
  },
  red_20: 'rgba(255,0,0,0.2)',
  red_75: 'rgba(255,0,0,0.75)',
  red_75_on_white: 'rgb(255,64,64)',
  transparent: 'rgba(0, 0, 0, 0)',
  transparent_on_white: '#FFFFFF',
  white: '#FFFFFF',
  get whiteOrBlack() {
    return this.white
  },
  get whiteOrBlueDark() {
    return this.white
  },
  get whiteOrGreenDark() {
    return this.white
  },
  get whiteOrWhite() {
    return this.white
  },
  get whiteOrWhite_75() {
    return this.white
  },
  white_0: 'rgba(255, 255, 255, 0)',
  white_0_on_white: '#FFFFFF',
  white_10: 'rgba(255, 255, 255, 0.10)',
  white_20: 'rgba(255, 255, 255, 0.20)',
  white_20_on_white: '#FFFFFF',
  white_35: 'rgba(255, 255, 255, 0.35)',
  white_40: 'rgba(255, 255, 255, 0.40)',
  get white_40OrBlack_60() {
    return this.white_40
  },
  get white_40OrWhite_40() {
    return this.white_40
  },
  white_40_on_white: '#FFFFFF',
  white_60: 'rgba(255, 255, 255, 0.60)',
  white_75: 'rgba(255, 255, 255, 0.75)',
  white_75_on_white: '#FFFFFF',
  white_90: 'rgba(255, 255, 255, 0.90)',
  white_90_on_white: '#FFFFFF',
  yellow: '#FFF75A',
  yellowDark: '#FFB800',
  yellowLight: '#FFFDCC',
  get yellowOrYellowAlt() {
    return '#ffffc0'
  },
} as const

export const darkColors: {[P in keyof typeof colors]: string | undefined} = {
  black: 'rgba(255, 255, 255, 0.85)',
  get blackOrBlack() {
    return colors.black
  },
  get blackOrWhite() {
    return colors.white
  },
  black_05: 'rgba(255, 255, 255, 0.05)',
  get black_05OrBlack_60() {
    return colors.black_60
  },
  get black_05OrWhite_10() {
    return colors.white_10
  },
  black_05_on_white: 'rgb(13, 13, 13)',
  black_10: 'rgba(255, 255, 255, 0.10)',
  get black_10OrBlack() {
    return colors.black
  },
  black_10_on_white: 'rgb(26, 26, 26)',
  black_20: 'rgba(255, 255, 255, 0.20)',
  get black_20OrBlack() {
    return colors.black
  },
  get black_20OrWhite_20() {
    return colors.white_20
  },
  black_20_on_white: 'rgb(51, 51, 51)',
  black_35: 'rgba(255, 255, 255, 0.35)',
  black_40: 'rgba(255, 255, 255, 0.40)',
  black_50: 'rgba(255, 255, 255, 0.50)',
  get black_50OrBlack_40() {
    return colors.black_40
  },
  get black_50OrBlack_50() {
    return colors.black_50
  },
  get black_50OrBlack_60() {
    return colors.black_60
  },
  get black_50OrWhite() {
    return colors.white
  },
  get black_50OrWhite_40() {
    return colors.white_40
  },
  get black_50OrWhite_75() {
    return colors.white_75
  },
  black_50_on_white: 'rgb(128, 128, 128)',
  black_60: 'rgba(255, 255, 255, 0.60)',
  black_63: 'rgba(255, 255, 255, 0.63)',
  black_on_white: 'rgb(217, 217, 217)',
  blue: '#4C8EFF',
  blueDark: '#3663EA',
  get blueDarkOrBlueLight() {
    return colors.blueLight
  },
  get blueDarkOrGreyDarkest() {
    return colors.greyDarkest
  },
  blueDarker: '#1036AC',
  blueDarker2: '#182D6E',
  blueDarker2_75: 'rgba(24, 45, 110, .75)',
  blueDarker2_75_on_white: 'rgb(173, 157, 108)',
  get blueDarkerOrBlack() {
    return colors.black
  },
  get blueDarkerOrBlack_60() {
    return colors.black_60
  },
  get blueDarkerOrBlack_85() {
    return 'rgba(0, 0, 0, .85)'
  },
  blueGrey: '#202020',
  blueGreyDark: 'rgba(24, 45, 110, .5)',
  blueGreyLight: '#222',
  blueLight: '#73A6FF',
  blueLighter: '#4C8EFF',
  blueLighter2: 'rgba(24, 45, 110, .5)',
  blueLighter3: '#101010',
  get blueLighterOrBlack_50() {
    return this.black_50
  },
  get blueLighterOrBlueDarker() {
    return this.blueDarker
  },
  get blueLighterOrBlueLight() {
    return colors.blueLight
  },
  get blueLighterOrWhite() {
    return colors.white
  },
  blueLighter_20: 'rgba(168, 204, 255, 0.2)',
  blueLighter_20_on_white: 'rgb(238, 245, 255)',
  blueLighter_40: 'rgba(168, 204, 255, 0.4)',
  blueLighter_40_on_white: 'rgb(220, 235, 255)',
  blueLighter_60: 'rgba(168, 204, 255, 0.6)',
  blueLighter_60_on_white: 'rgb(203, 224, 255)',
  blue_10: 'rgba(51, 160, 255, 0.1)',
  blue_30: 'rgba(51, 160, 255, 0.3)',
  blue_30_on_white: 'rgb(192,226,255)',
  blue_60: 'rgba(51, 160, 255, 0.6)',
  blue_60_on_white: 'rgb(133,198,255)',
  brown: 'rgb(71, 31, 17)',
  brown_75: 'rgba(71, 31, 17, 0.75)',
  get brown_75OrYellow() {
    return colors.yellow
  },
  brown_75_on_white: 'rgb(117,87,78)',
  fastBlank: isIOS ? '#191919' : undefined, // on iOS overdraw is eliminated if we use solid color, on Android it's eliminated if it's transparent /shrug
  green: '#37BD99',
  greenDark: '#189e7a',
  get greenDarkOrBlack() {
    return colors.black
  },
  get greenDarkOrWhite() {
    return colors.white
  },
  greenDarker: '#12785d',
  greenLight: '#B7EED9',
  get greenLightOrWhite() {
    return colors.white
  },
  greenLighter: '#E8FAF6',
  get greenLighterOrGreen() {
    return colors.green
  },
  get greenLighterOrGreenDark() {
    return colors.greenDark
  },
  get greenOrGreenLighter() {
    return colors.greenLighter
  },
  grey: '#333',
  greyDark: '#666',
  greyDarker: '#999',
  greyDarkest: '#aaa',
  greyLight: '#444',
  orange: '#ff6f21',
  orange_90: 'rgba(255, 111, 33, 0.9)',
  purple: '#8852ff',
  purpleDark: '#6d3fd1',
  get purpleDarkOrWhite() {
    return colors.white
  },
  purpleDarker: '#5128a8',
  purpleLight: '#9d70ff',
  purpleLighter: '#E8DEFF',
  get purpleOrWhite() {
    return colors.white
  },
  purple_01: 'rgba(132, 82, 255, 0.01)',
  purple_10: 'rgba(132, 82, 255, 0.1)',
  get purple_10OrPurple() {
    return colors.purple
  },
  purple_30: 'rgba(132, 82, 255, 0.3)',
  purple_40: 'rgba(132, 82, 255, 0.4)',
  red: '#ff4d61',
  redDark: '#eb253b',
  get redDarkOrWhite() {
    return colors.white
  },
  redDarker: '#bd0b1f',
  redLight: '#FFCAC1',
  redLighter: '#2d2d2d',
  red_10: 'rgba(255,0,0,0.1)',
  get red_10OrRed() {
    return colors.red
  },
  red_20: 'rgba(255,0,0,0.2)',
  red_75: 'rgba(255,0,0,0.75)',
  red_75_on_white: 'rgb(255,64,64)',
  transparent: 'rgba(255, 255, 255, 0)',
  transparent_on_white: '#191919',
  white: '#191919',
  get whiteOrBlack() {
    return colors.black
  },
  get whiteOrBlueDark() {
    return colors.blueDark
  },
  get whiteOrGreenDark() {
    return colors.greenDark
  },
  get whiteOrWhite() {
    return colors.white
  },
  get whiteOrWhite_75() {
    return colors.white_75
  },
  white_0: 'rgba(25, 25, 25, 0)',
  white_0_on_white: '#191919',
  white_10: 'rgba(25, 25, 25, 0.10)',
  white_20: 'rgba(25, 25, 25, 0.20)',
  white_20_on_white: '#191919',
  white_35: 'rgba(25, 25, 25, 0.35)',
  white_40: 'rgba(25, 25, 25, 0.40)',
  get white_40OrBlack_60() {
    return colors.black_60
  },
  get white_40OrWhite_40() {
    return colors.white_40
  },
  white_40_on_white: '#191919',
  white_60: 'rgba(25, 25, 25, 0.60)',
  white_75: 'rgba(25, 25, 25, 0.75)',
  white_75_on_white: '#191919',
  white_90: 'rgba(25, 25, 25, 0.90)',
  white_90_on_white: '#191919',
  yellow: '#FFF75A',
  yellowDark: '#FFB800',
  yellowLight: '#FFFDCC',
  get yellowOrYellowAlt() {
    return '#616161'
  },
}

const partyFallbackColors: {[P in keyof typeof colors]?: string | undefined} = {
  black: 'rgba(255, 255, 255, 0.85)',
  get blackOrBlack() {
    return colors.black
  },
  get blackOrWhite() {
    return colors.white
  },
  get black_05OrBlack_60() {
    return colors.black_60
  },
  black_05_on_white: 'rgb(13, 13, 13)',
  black_10_on_white: 'rgb(26, 26, 26)',
  get black_20OrBlack() {
    return colors.black
  },
  black_20_on_white: 'rgb(51, 51, 51)',
  get black_50OrWhite() {
    return colors.white
  },
  get black_50OrWhite_75() {
    return colors.white_75
  },
  black_50_on_white: 'rgb(128, 128, 128)',
  black_60: 'rgba(255, 255, 255, 0.60)',
  black_63: 'rgba(255, 255, 255, 0.63)',
  black_on_white: 'rgb(217, 217, 217)',
  transparent: 'rgba(255, 255, 255, 0)',
  transparent_on_white: '#191919',
  white: '#191919',
  get whiteOrBlack() {
    return colors.black
  },
  get whiteOrGreenDark() {
    return '#FF00FF'
  },

  white_0: 'rgba(25, 25, 25, 0)',
  white_0_on_white: '#191919',
  white_20_on_white: '#191919',
  get white_40OrBlack_60() {
    return colors.black_60
  },
  white_40_on_white: '#191919',
  white_75: 'rgba(25, 25, 25, 0.75)',
  white_75_on_white: '#191919',
  white_90: 'rgba(25, 25, 25, 0.90)',
  white_90_on_white: '#191919',
}

type Color = typeof colors
type Names = keyof Color

const names: Array<Names> = Object.keys(colors) as any

let iosDynamicColors: {[P in keyof typeof colors]: (typeof colors)[P]}
if (isIOS) {
  iosDynamicColors = names.reduce<Color>((obj, name) => {
    const {DynamicColorIOS} = require('react-native')
    // @ts-ignore
    obj[name] = DynamicColorIOS({dark: darkColors[name], light: colors[name]})
    return obj
    // eslint-disable-next-line
  }, {} as Color)
} else {
  iosDynamicColors = colors
}

export const themed: {[P in keyof typeof colors]: (typeof colors)[P]} = names.reduce<Color>((obj, name) => {
  if (isIOS) {
    // ios actually handles this nicely natively
    return Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get() {
        // if we're in auto mode, use ios native dynamic colors
        if (isDarkModePreference() === 'system') {
          return iosDynamicColors[name]
        }
        return isDarkMode() ? darkColors[name] : colors[name]
      },
    })
  } else {
    return Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get() {
        if (partyMode && isDarkMode()) {
          // sets all non-grayscale colors to magenta in dark mode when enabled
          return (partyFallbackColors as any)[name] || '#FF00FF'
        }

        return isDarkMode() ? darkColors[name] : colors[name]
      },
    })
  }
  // eslint-disable-next-line
}, {} as Color)

if (__DEV__) {
  const t = themed as any
  t.random = () =>
    `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(
      Math.random() * 256
    )}, 1)`
}

export default colors
