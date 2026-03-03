// the _on_white are precomputed colors so we can do less blending on mobile
import {useDarkModeState} from '@/stores/darkmode'
import {isIOS, isAndroid} from '@/constants/platform'
import type {DynamicColorIOS as DynamicColorIOSType} from 'react-native'
import type {Opaque} from '@/constants/types/ts'

// Define all colors with their light/dark variants in one place
const colorDefs = {
  black: {dark: 'rgba(255, 255, 255, 0.85)', light: 'rgba(0, 0, 0, 0.85)'},
  black_05: {dark: 'rgba(255, 255, 255, 0.05)', light: 'rgba(0, 0, 0, 0.05)'},
  black_05_on_white: {dark: 'rgb(13, 13, 13)', light: 'rgb(242,242,242)'},
  black_10: {dark: 'rgba(255, 255, 255, 0.10)', light: 'rgba(0, 0, 0, 0.10)'},
  black_10_on_white: {dark: 'rgb(26, 26, 26)', light: 'rgb(229,229,229)'},
  black_20: {dark: 'rgba(255, 255, 255, 0.20)', light: 'rgba(0, 0, 0, 0.20)'},
  black_20_on_white: {dark: 'rgb(51, 51, 51)', light: 'rgb(204,204,204)'},
  black_35: {dark: 'rgba(255, 255, 255, 0.35)', light: 'rgba(0, 0, 0, 0.35)'},
  black_40: {dark: 'rgba(255, 255, 255, 0.40)', light: 'rgba(0, 0, 0, 0.40)'},
  black_50: {dark: 'rgba(255, 255, 255, 0.50)', light: 'rgba(0, 0, 0, 0.50)'},
  black_50_on_white: {dark: 'rgb(128, 128, 128)', light: 'rgb(127,127,127)'},
  black_60: {dark: 'rgba(255, 255, 255, 0.60)', light: 'rgba(0, 0, 0, 0.60)'},
  black_63: {dark: 'rgba(255, 255, 255, 0.63)', light: 'rgba(0, 0, 0, 0.63)'},
  black_on_white: {dark: 'rgb(217, 217, 217)', light: 'rgb(38,38,38)'},
  blue: {dark: '#4C8EFF', light: '#4C8EFF'},
  blueDark: {dark: '#3663EA', light: '#3663EA'},
  blueDarker: {dark: '#1036AC', light: '#1036AC'},
  blueDarker2: {dark: '#182D6E', light: '#182D6E'},
  blueDarker2_75: {dark: 'rgba(24, 45, 110, .75)', light: 'rgba(24, 45, 110, .75)'},
  blueDarker2_75_on_white: {dark: 'rgb(173, 157, 108)', light: 'rgb(82,98,147)'},
  blueGrey: {dark: '#202020', light: '#F2F4F7'},
  blueGreyDark: {dark: 'rgba(24, 45, 110, .5)', light: '#E0E8F6'},
  blueGreyLight: {dark: '#222', light: '#F9F9FA'},
  blueLight: {dark: '#73A6FF', light: '#73A6FF'},
  blueLighter: {dark: '#4C8EFF', light: '#A8CCFF'},
  blueLighter2: {dark: 'rgba(24, 45, 110, .5)', light: '#EBF2FC'},
  blueLighter3: {dark: '#101010', light: '#F7F9FC'},
  blueLighterOrBlack_50: {dark: 'rgba(255, 255, 255, 0.50)', light: '#A8CCFF'},
  blueLighter_20: {dark: 'rgba(168, 204, 255, 0.2)', light: 'rgba(168, 204, 255, 0.2)'},
  blueLighter_20_on_white: {dark: 'rgb(238, 245, 255)', light: 'rgb(238, 245, 255)'},
  blueLighter_40: {dark: 'rgba(168, 204, 255, 0.4)', light: 'rgba(168, 204, 255, 0.4)'},
  blueLighter_40_on_white: {dark: 'rgb(220, 235, 255)', light: 'rgb(220, 235, 255)'},
  blueLighter_60: {dark: 'rgba(168, 204, 255, 0.6)', light: 'rgba(168, 204, 255, 0.6)'},
  blueLighter_60_on_white: {dark: 'rgb(203, 224, 255)', light: 'rgb(203, 224, 255)'},
  blue_10: {dark: 'rgba(51, 160, 255, 0.1)', light: 'rgba(51, 160, 255, 0.1)'},
  blue_30: {dark: 'rgba(51, 160, 255, 0.3)', light: 'rgba(51, 160, 255, 0.3)'},
  blue_30_on_white: {dark: 'rgb(192,226,255)', light: 'rgb(192,226,255)'},
  blue_60: {dark: 'rgba(51, 160, 255, 0.6)', light: 'rgba(51, 160, 255, 0.6)'},
  blue_60_on_white: {dark: 'rgb(133,198,255)', light: 'rgb(133,198,255)'},
  brown: {dark: 'rgb(71, 31, 17)', light: 'rgb(71, 31, 17)'},
  brown_75: {dark: 'rgba(71, 31, 17, 0.75)', light: 'rgba(71, 31, 17, 0.75)'},
  brown_75_on_white: {dark: 'rgb(117,87,78)', light: 'rgb(117,87,78)'},
  fastBlank: {dark: undefined, light: undefined},
  green: {dark: '#37BD99', light: '#37BD99'},
  greenDark: {dark: '#189E7A', light: '#189E7A'},
  greenDarker: {dark: '#12785D', light: '#12785D'},
  greenLight: {dark: '#B7EED9', light: '#B7EED9'},
  greenLighter: {dark: '#E8FAF6', light: '#E8FAF6'},
  grey: {dark: '#333', light: '#E6E6E6'},
  greyDark: {dark: '#666', light: '#CCCCCC'},
  greyDarker: {dark: '#999', light: '#AAAAAA'},
  greyDarkest: {dark: '#AAA', light: '#2D2D2D'},
  greyLight: {dark: '#444', light: '#F0F0F0'},
  orange: {dark: '#FF6F21', light: '#FF6F21'},
  orange_90: {dark: 'rgba(255, 111, 33, 0.9)', light: 'rgba(255, 111, 33, 0.9)'},
  purple: {dark: '#8852FF', light: '#8852FF'},
  purpleDark: {dark: '#6D3FD1', light: '#6D3FD1'},
  purpleDarker: {dark: '#5128a8', light: '#5128a8'},
  purpleLight: {dark: '#9D70FF', light: '#9D70FF'},
  purpleLighter: {dark: '#E8DEFF', light: '#E8DEFF'},
  purple_01: {dark: 'rgba(132, 82, 255, 0.01)', light: 'rgba(132, 82, 255, 0.01)'},
  purple_10: {dark: 'rgba(132, 82, 255, 0.1)', light: 'rgba(132, 82, 255, 0.1)'},
  purple_30: {dark: 'rgba(132, 82, 255, 0.3)', light: 'rgba(132, 82, 255, 0.3)'},
  purple_40: {dark: 'rgba(132, 82, 255, 0.4)', light: 'rgba(132, 82, 255, 0.4)'},
  red: {dark: '#FF4D61', light: '#FF4D61'},
  redDark: {dark: '#EB253B', light: '#EB253B'},
  redDarker: {dark: '#BD0B1F', light: '#BD0B1F'},
  redLight: {dark: '#FFCAC1', light: '#FFCAC1'},
  redLighter: {dark: '#2D2D2D', light: '#FAF2ED'},
  red_10: {dark: 'rgba(255,0,0,0.1)', light: 'rgba(255,0,0,0.1)'},
  red_20: {dark: 'rgba(255,0,0,0.2)', light: 'rgba(255,0,0,0.2)'},
  red_75: {dark: 'rgba(255,0,0,0.75)', light: 'rgba(255,0,0,0.75)'},
  red_75_on_white: {dark: 'rgb(255,64,64)', light: 'rgb(255,64,64)'},
  transparent: {dark: 'rgba(255, 255, 255, 0)', light: 'rgba(0, 0, 0, 0)'},
  transparent_on_white: {dark: '#191919', light: '#FFFFFF'},
  white: {dark: '#191919', light: '#FFFFFF'},
  white_0: {dark: 'rgba(25, 25, 25, 0)', light: 'rgba(255, 255, 255, 0)'},
  white_0_on_white: {dark: '#191919', light: '#FFFFFF'},
  white_10: {dark: 'rgba(25, 25, 25, 0.10)', light: 'rgba(255, 255, 255, 0.10)'},
  white_20: {dark: 'rgba(25, 25, 25, 0.20)', light: 'rgba(255, 255, 255, 0.20)'},
  white_20_on_white: {dark: '#191919', light: '#FFFFFF'},
  white_35: {dark: 'rgba(25, 25, 25, 0.35)', light: 'rgba(255, 255, 255, 0.35)'},
  white_40: {dark: 'rgba(25, 25, 25, 0.40)', light: 'rgba(255, 255, 255, 0.40)'},
  white_40_on_white: {dark: '#191919', light: '#FFFFFF'},
  white_60: {dark: 'rgba(25, 25, 25, 0.60)', light: 'rgba(255, 255, 255, 0.60)'},
  white_75: {dark: 'rgba(25, 25, 25, 0.75)', light: 'rgba(255, 255, 255, 0.75)'},
  white_75_on_white: {dark: '#191919', light: '#FFFFFF'},
  white_90: {dark: 'rgba(25, 25, 25, 0.90)', light: 'rgba(255, 255, 255, 0.90)'},
  white_90_on_white: {dark: '#191919', light: '#FFFFFF'},
  yellow: {dark: '#FFF75A', light: '#FFF75A'},
  yellowDark: {dark: '#FFB800', light: '#FFB800'},
  yellowLight: {dark: '#FFFDCC', light: '#FFFDCC'},
} as const

//  colors based on light names
const colorVariants = {
  blackOrBlack: {dark: 'black', light: 'black'},
  blackOrWhite: {dark: 'white', light: 'black'},
  black_05OrBlack: {dark: 'black', light: 'black_05'},
  black_05OrBlack_60: {dark: 'black_60', light: 'black_05'},
  black_05OrWhite_10: {dark: 'white_10', light: 'black_05'},
  black_10OrBlack: {dark: 'black', light: 'black_10'},
  black_20OrBlack: {dark: 'black', light: 'black_20'},
  black_20OrWhite_20: {dark: 'white_20', light: 'black_20'},
  black_50OrBlack_40: {dark: 'black_40', light: 'black_50'},
  black_50OrBlack_50: {dark: 'black_50', light: 'black_50'},
  black_50OrBlack_60: {dark: 'black_60', light: 'black_50'},
  black_50OrWhite: {dark: 'white', light: 'black_50'},
  black_50OrWhite_40: {dark: 'white_40', light: 'black_50'},
  black_50OrWhite_75: {dark: 'white_75', light: 'black_50'},
  blueDarkOrBlueLight: {dark: 'blueLight', light: 'blueDark'},
  blueDarkOrGreyDarkest: {dark: 'greyDarkest', light: 'blueDark'},
  blueDarkerOrBlack: {dark: 'black', light: 'blueDarker'},
  blueDarkerOrBlack_60: {dark: 'black_60', light: 'blueDarker'},
  blueLighterOrBlueDarker: {dark: 'blueDarker', light: 'blueLighter'},
  blueLighterOrBlueLight: {dark: 'blueLight', light: 'blueLighter'},
  blueLighterOrWhite: {dark: 'white', light: 'blueLighter'},
  greenDarkOrBlack: {dark: 'black', light: 'greenDark'},
  greenDarkOrWhite: {dark: 'white', light: 'greenDark'},
  greenLightOrWhite: {dark: 'white', light: 'greenLight'},
  greenLighterOrGreen: {dark: 'green', light: 'greenLighter'},
  greenLighterOrGreenDark: {dark: 'greenDark', light: 'greenLighter'},
  greenOrGreenLighter: {dark: 'greenLighter', light: 'greenLighter'},
  purpleDarkOrWhite: {dark: 'white', light: 'purpleDark'},
  purpleOrWhite: {dark: 'white', light: 'purple'},
  purple_10OrPurple: {dark: 'purple', light: 'purple_10'},
  redDarkOrWhite: {dark: 'white', light: 'redDark'},
  red_10OrRed: {dark: 'red', light: 'red_10'},
  whiteOrBlack: {dark: 'black', light: 'white'},
  whiteOrBlueDark: {dark: 'blueDark', light: 'white'},
  whiteOrGreenDark: {dark: 'greenDark', light: 'white'},
  whiteOrWhite: {dark: 'white', light: 'white'},
  whiteOrWhite_75: {dark: 'white_75', light: 'white'},
  white_40OrBlack_60: {dark: 'black_60', light: 'white_40'},
  white_40OrWhite_40: {dark: 'white_40', light: 'white_40'},
} as const

// Special variants with literal values
const specialVariants = {
  blueDarkerOrBlack_85: {dark: 'rgba(0, 0, 0, .85)', light: 'blueDarker'},
  brown_75OrYellow: {dark: 'yellow', light: 'brown_75'},
  yellowOrYellowAlt: {dark: '#C3C390', light: '#FFFFC0'},
} as const

type ColorNames = keyof typeof colorDefs | keyof typeof colorVariants | keyof typeof specialVariants

// Create a unique opaque type for each color name
type OpaqueColors = {
  [K in ColorNames]: Opaque<string, K>
}

function createColorObject(mode: 'light' | 'dark') {
  const result = {} as Record<ColorNames, string>

  for (const [_key, val] of Object.entries(colorDefs)) {
    const key = _key as keyof typeof colorDefs
    const color = val[mode]
    result[key] = color as string
  }

  for (const [_key, val] of Object.entries(colorVariants)) {
    const key = _key as keyof typeof colorVariants
    const colorName = val[mode]
    result[key] = colorDefs[colorName].light
  }

  for (const [_key, val] of Object.entries(specialVariants)) {
    const key = _key as keyof typeof specialVariants
    const ref = val[mode]
    const r = result as Record<string, string>
    result[key] = r[ref] ?? ref
  }

  return result as {[K in ColorNames]: OpaqueColors[K]}
}

export const colors = createColorObject('light')
export const darkColors = createColorObject('dark')

type Color = typeof colors
type Names = keyof Color

const names = Object.keys(colors) as Array<Names>
let iosDynamicColors: Color
if (isIOS) {
  const {DynamicColorIOS} = require('react-native') as {
    DynamicColorIOS: typeof DynamicColorIOSType
  }
  iosDynamicColors = names.reduce<{[key: string]: unknown}>((obj, name) => {
    obj[name] =
      name === 'fastBlank' ? undefined : DynamicColorIOS({dark: darkColors[name], light: colors[name]})
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
