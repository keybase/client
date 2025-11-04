// the _on_white are precomputed colors so we can do less blending on mobile
import {useState_ as useDarkModeState} from '@/constants/darkmode'
import {isIOS, isAndroid} from '@/constants/platform'
import type {DynamicColorIOS as DynamicColorIOSType} from 'react-native'

// Define all colors with their light/dark variants in one place
const colorDefs = {
  // Base colors
  black: {light: 'rgba(0, 0, 0, 0.85)', dark: 'rgba(255, 255, 255, 0.85)'},
  black_05: {light: 'rgba(0, 0, 0, 0.05)', dark: 'rgba(255, 255, 255, 0.05)'},
  black_05_on_white: {light: 'rgb(242,242,242)', dark: 'rgb(13, 13, 13)'},
  black_10: {light: 'rgba(0, 0, 0, 0.10)', dark: 'rgba(255, 255, 255, 0.10)'},
  black_10_on_white: {light: 'rgb(229,229,229)', dark: 'rgb(26, 26, 26)'},
  black_20: {light: 'rgba(0, 0, 0, 0.20)', dark: 'rgba(255, 255, 255, 0.20)'},
  black_20_on_white: {light: 'rgb(204,204,204)', dark: 'rgb(51, 51, 51)'},
  black_35: {light: 'rgba(0, 0, 0, 0.35)', dark: 'rgba(255, 255, 255, 0.35)'},
  black_40: {light: 'rgba(0, 0, 0, 0.40)', dark: 'rgba(255, 255, 255, 0.40)'},
  black_50: {light: 'rgba(0, 0, 0, 0.50)', dark: 'rgba(255, 255, 255, 0.50)'},
  black_50_on_white: {light: 'rgb(127,127,127)', dark: 'rgb(128, 128, 128)'},
  black_60: {light: 'rgba(0, 0, 0, 0.60)', dark: 'rgba(255, 255, 255, 0.60)'},
  black_63: {light: 'rgba(0, 0, 0, 0.63)', dark: 'rgba(255, 255, 255, 0.63)'},
  black_on_white: {light: 'rgb(38,38,38)', dark: 'rgb(217, 217, 217)'},
  blue: {light: '#4C8EFF', dark: '#4C8EFF'},
  blueDark: {light: '#3663EA', dark: '#3663EA'},
  blueDarker: {light: '#1036AC', dark: '#1036AC'},
  blueDarker2: {light: '#182D6E', dark: '#182D6E'},
  blueDarker2_75: {light: 'rgba(24, 45, 110, .75)', dark: 'rgba(24, 45, 110, .75)'},
  blueDarker2_75_on_white: {light: 'rgb(82,98,147)', dark: 'rgb(173, 157, 108)'},
  blueGrey: {light: '#F2F4F7', dark: '#202020'},
  blueGreyDark: {light: '#E0E8F6', dark: 'rgba(24, 45, 110, .5)'},
  blueGreyLight: {light: '#F9F9FA', dark: '#222'},
  blueLight: {light: '#73A6FF', dark: '#73A6FF'},
  blueLighter: {light: '#A8CCFF', dark: '#4C8EFF'},
  blueLighter2: {light: '#EBF2FC', dark: 'rgba(24, 45, 110, .5)'},
  blueLighter3: {light: '#F7F9FC', dark: '#101010'},
  blueLighter_20: {light: 'rgba(168, 204, 255, 0.2)', dark: 'rgba(168, 204, 255, 0.2)'},
  blueLighter_20_on_white: {light: 'rgb(238, 245, 255)', dark: 'rgb(238, 245, 255)'},
  blueLighter_40: {light: 'rgba(168, 204, 255, 0.4)', dark: 'rgba(168, 204, 255, 0.4)'},
  blueLighter_40_on_white: {light: 'rgb(220, 235, 255)', dark: 'rgb(220, 235, 255)'},
  blueLighter_60: {light: 'rgba(168, 204, 255, 0.6)', dark: 'rgba(168, 204, 255, 0.6)'},
  blueLighter_60_on_white: {light: 'rgb(203, 224, 255)', dark: 'rgb(203, 224, 255)'},
  blue_10: {light: 'rgba(51, 160, 255, 0.1)', dark: 'rgba(51, 160, 255, 0.1)'},
  blue_30: {light: 'rgba(51, 160, 255, 0.3)', dark: 'rgba(51, 160, 255, 0.3)'},
  blue_30_on_white: {light: 'rgb(192,226,255)', dark: 'rgb(192,226,255)'},
  blue_60: {light: 'rgba(51, 160, 255, 0.6)', dark: 'rgba(51, 160, 255, 0.6)'},
  blue_60_on_white: {light: 'rgb(133,198,255)', dark: 'rgb(133,198,255)'},
  brown: {light: 'rgb(71, 31, 17)', dark: 'rgb(71, 31, 17)'},
  brown_75: {light: 'rgba(71, 31, 17, 0.75)', dark: 'rgba(71, 31, 17, 0.75)'},
  brown_75_on_white: {light: 'rgb(117,87,78)', dark: 'rgb(117,87,78)'},
  fastBlank: {light: isIOS ? '#FFFFFF' : undefined, dark: isIOS ? '#191919' : undefined},
  green: {light: '#37BD99', dark: '#37BD99'},
  greenDark: {light: '#189e7a', dark: '#189e7a'},
  greenDarker: {light: '#12785d', dark: '#12785d'},
  greenLight: {light: '#B7EED9', dark: '#B7EED9'},
  greenLighter: {light: '#E8FAF6', dark: '#E8FAF6'},
  grey: {light: '#e6e6e6', dark: '#333'},
  greyDark: {light: '#cccccc', dark: '#666'},
  greyDarker: {light: '#aaaaaa', dark: '#999'},
  greyDarkest: {light: '#2d2d2d', dark: '#aaa'},
  greyLight: {light: '#f0f0f0', dark: '#444'},
  orange: {light: '#ff6f21', dark: '#ff6f21'},
  orange_90: {light: 'rgba(255, 111, 33, 0.9)', dark: 'rgba(255, 111, 33, 0.9)'},
  purple: {light: '#8852ff', dark: '#8852ff'},
  purpleDark: {light: '#6d3fd1', dark: '#6d3fd1'},
  purpleDarker: {light: '#5128a8', dark: '#5128a8'},
  purpleLight: {light: '#9d70ff', dark: '#9d70ff'},
  purpleLighter: {light: '#E8DEFF', dark: '#E8DEFF'},
  purple_01: {light: 'rgba(132, 82, 255, 0.01)', dark: 'rgba(132, 82, 255, 0.01)'},
  purple_10: {light: 'rgba(132, 82, 255, 0.1)', dark: 'rgba(132, 82, 255, 0.1)'},
  purple_30: {light: 'rgba(132, 82, 255, 0.3)', dark: 'rgba(132, 82, 255, 0.3)'},
  purple_40: {light: 'rgba(132, 82, 255, 0.4)', dark: 'rgba(132, 82, 255, 0.4)'},
  red: {light: '#ff4d61', dark: '#ff4d61'},
  redDark: {light: '#eb253b', dark: '#eb253b'},
  redDarker: {light: '#bd0b1f', dark: '#bd0b1f'},
  redLight: {light: '#FFCAC1', dark: '#FFCAC1'},
  redLighter: {light: '#FAF2ED', dark: '#2d2d2d'},
  red_10: {light: 'rgba(255,0,0,0.1)', dark: 'rgba(255,0,0,0.1)'},
  red_20: {light: 'rgba(255,0,0,0.2)', dark: 'rgba(255,0,0,0.2)'},
  red_75: {light: 'rgba(255,0,0,0.75)', dark: 'rgba(255,0,0,0.75)'},
  red_75_on_white: {light: 'rgb(255,64,64)', dark: 'rgb(255,64,64)'},
  transparent: {light: 'rgba(0, 0, 0, 0)', dark: 'rgba(255, 255, 255, 0)'},
  transparent_on_white: {light: '#FFFFFF', dark: '#191919'},
  white: {light: '#FFFFFF', dark: '#191919'},
  white_0: {light: 'rgba(255, 255, 255, 0)', dark: 'rgba(25, 25, 25, 0)'},
  white_0_on_white: {light: '#FFFFFF', dark: '#191919'},
  white_10: {light: 'rgba(255, 255, 255, 0.10)', dark: 'rgba(25, 25, 25, 0.10)'},
  white_20: {light: 'rgba(255, 255, 255, 0.20)', dark: 'rgba(25, 25, 25, 0.20)'},
  white_20_on_white: {light: '#FFFFFF', dark: '#191919'},
  white_35: {light: 'rgba(255, 255, 255, 0.35)', dark: 'rgba(25, 25, 25, 0.35)'},
  white_40: {light: 'rgba(255, 255, 255, 0.40)', dark: 'rgba(25, 25, 25, 0.40)'},
  white_40_on_white: {light: '#FFFFFF', dark: '#191919'},
  white_60: {light: 'rgba(255, 255, 255, 0.60)', dark: 'rgba(25, 25, 25, 0.60)'},
  white_75: {light: 'rgba(255, 255, 255, 0.75)', dark: 'rgba(25, 25, 25, 0.75)'},
  white_75_on_white: {light: '#FFFFFF', dark: '#191919'},
  white_90: {light: 'rgba(255, 255, 255, 0.90)', dark: 'rgba(25, 25, 25, 0.90)'},
  white_90_on_white: {light: '#FFFFFF', dark: '#191919'},
  yellow: {light: '#FFF75A', dark: '#FFF75A'},
  yellowDark: {light: '#FFB800', dark: '#FFB800'},
  yellowLight: {light: '#FFFDCC', dark: '#FFFDCC'},
} as const

// Define variant getters that reference other colors
type ColorKey = keyof typeof colorDefs
const colorVariants: Record<string, {light: ColorKey; dark: ColorKey}> = {
  blackOrBlack: {light: 'black', dark: 'black'},
  blackOrWhite: {light: 'black', dark: 'white'},
  black_05OrBlack: {light: 'black_05', dark: 'black'},
  black_05OrBlack_60: {light: 'black_05', dark: 'black_60'},
  black_05OrWhite_10: {light: 'black_05', dark: 'white_10'},
  black_10OrBlack: {light: 'black_10', dark: 'black'},
  black_20OrBlack: {light: 'black_20', dark: 'black'},
  black_20OrWhite_20: {light: 'black_20', dark: 'white_20'},
  black_50OrBlack_40: {light: 'black_50', dark: 'black_40'},
  black_50OrBlack_50: {light: 'black_50', dark: 'black_50'},
  black_50OrBlack_60: {light: 'black_50', dark: 'black_60'},
  black_50OrWhite: {light: 'black_50', dark: 'white'},
  black_50OrWhite_40: {light: 'black_50', dark: 'white_40'},
  black_50OrWhite_75: {light: 'black_50', dark: 'white_75'},
  blueDarkOrBlueLight: {light: 'blueDark', dark: 'blueLight'},
  blueDarkOrGreyDarkest: {light: 'blueDark', dark: 'greyDarkest'},
  blueDarkerOrBlack: {light: 'blueDarker', dark: 'black'},
  blueDarkerOrBlack_60: {light: 'blueDarker', dark: 'black_60'},
  blueLighterOrBlack_50: {light: 'blueLighter', dark: 'black_50'},
  blueLighterOrBlueDarker: {light: 'blueLighter', dark: 'blueDarker'},
  blueLighterOrBlueLight: {light: 'blueLighter', dark: 'blueLight'},
  blueLighterOrWhite: {light: 'blueLighter', dark: 'white'},
  greenDarkOrBlack: {light: 'greenDark', dark: 'black'},
  greenDarkOrWhite: {light: 'greenDark', dark: 'white'},
  greenLightOrWhite: {light: 'greenLight', dark: 'white'},
  greenLighterOrGreen: {light: 'greenLighter', dark: 'green'},
  greenLighterOrGreenDark: {light: 'greenLighter', dark: 'greenDark'},
  greenOrGreenLighter: {light: 'greenLighter', dark: 'greenLighter'},
  purpleDarkOrWhite: {light: 'purpleDark', dark: 'white'},
  purpleOrWhite: {light: 'purple', dark: 'white'},
  purple_10OrPurple: {light: 'purple_10', dark: 'purple'},
  redDarkOrWhite: {light: 'redDark', dark: 'white'},
  red_10OrRed: {light: 'red_10', dark: 'red'},
  whiteOrBlack: {light: 'white', dark: 'black'},
  whiteOrBlueDark: {light: 'white', dark: 'blueDark'},
  whiteOrGreenDark: {light: 'white', dark: 'greenDark'},
  whiteOrWhite: {light: 'white', dark: 'white'},
  whiteOrWhite_75: {light: 'white', dark: 'white_75'},
  white_40OrBlack_60: {light: 'white_40', dark: 'black_60'},
  white_40OrWhite_40: {light: 'white_40', dark: 'white_40'},
}

// Special variants with literal values
const specialVariants = {
  blueDarkerOrBlack_85: {light: 'blueDarker', dark: 'rgba(0, 0, 0, .85)'},
  brown_75OrYellow: {light: 'brown_75', dark: 'yellow'},
  yellowOrYellowAlt: {light: '#ffffc0', dark: '#c3c390'},
} as const

// Generate color objects
function createColorObject(mode: 'light' | 'dark') {
  const result: any = {}

  // Add base colors
  for (const [key, val] of Object.entries(colorDefs)) {
    result[key] = val[mode]
  }

  // Add variant getters
  for (const [key, val] of Object.entries(colorVariants)) {
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      get() {
        return result[val[mode]]
      },
    })
  }

  // Add special variants
  for (const [key, val] of Object.entries(specialVariants)) {
    Object.defineProperty(result, key, {
      configurable: false,
      enumerable: true,
      get() {
        const ref = val[mode]
        return typeof ref === 'string' && ref in result ? result[ref] : ref
      },
    })
  }

  return result
}

export const colors = createColorObject('light') as const
export const darkColors: {[P in keyof typeof colors]: string | undefined} = createColorObject('dark')

type Color = typeof colors
type Names = keyof Color

const names = Object.keys(colors) as Array<Names>
let iosDynamicColors: Color
if (isIOS) {
  const {DynamicColorIOS} = require('react-native') as {
    DynamicColorIOS: typeof DynamicColorIOSType
  }
  iosDynamicColors = names.reduce<{[key: string]: unknown}>((obj, name) => {
    obj[name] = DynamicColorIOS({dark: darkColors[name] ?? '', light: colors[name] ?? ''})
    return obj
  }, {}) as Color
} else {
  iosDynamicColors = colors
}

export const themed: {[P in keyof typeof colors]: (typeof colors)[P]} = names.reduce<Color>((obj, name) => {
  const {isDarkMode} = useDarkModeState.getState()
  if (isIOS) {
    // ios actually handles this nicely natively
    return Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get() {
        return iosDynamicColors[name]
      },
    })
  } else if (isAndroid) {
    return Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get() {
        return isDarkMode() ? darkColors[name] : colors[name]
      },
    })
  } else {
    // desktop
    return Object.defineProperty(obj, name, {
      configurable: false,
      enumerable: true,
      get() {
        return `var(--color-${name})`
      },
    })
  }
}, {} as Color)

if (__DEV__) {
  const t = themed as unknown as {random: () => string}
  t.random = () =>
    `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(
      Math.random() * 256
    )}, 1)`
}

export default colors
