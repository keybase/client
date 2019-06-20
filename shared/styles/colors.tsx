// the _on_white are precomputed colors so we can do less blending on mobile
import {isDarkMode} from './dark-mode'
import {isIOS} from '../constants/platform'

export const colors = {
  black: 'rgba(0, 0, 0, 0.85)',
  black_05: 'rgba(0, 0, 0, 0.05)',
  black_05_on_white: 'rgb(242,242,242)',
  black_10: 'rgba(0, 0, 0, 0.10)',
  black_10_on_white: 'rgb(229,229,229)',
  black_20: 'rgba(0, 0, 0, 0.20)',
  black_20_on_white: 'rgb(204,204,204)',
  black_35: 'rgba(0, 0, 0, 0.35)',
  black_40: 'rgba(0, 0, 0, 0.40)',
  black_50: 'rgba(0, 0, 0, 0.50)',
  black_50_on_white: 'rgb(127,127,127)',
  black_60: 'rgba(0, 0, 0, 0.60)',
  black_63: 'rgba(0, 0, 0, 0.63)',
  black_75: 'rgba(0, 0, 0, 0.75)',
  black_on_white: 'rgb(38,38,38)',
  blue: '#4C8EFF',
  blueDark: '#3663EA',
  blueDarker: '#1036AC',
  blueGrey: '#F2F4F7',
  blueGreyDark: '#E0E8F6',
  blueLight: '#73A6FF',
  blueLighter: '#A8CCFF',
  blueLighter2: '#EBF2FC',
  blueLighter3: '#F7F9FC',
  blueLighter_20: 'rgba(168, 204, 255, 0.2)',
  blueLighter_20_on_white: 'rgb(238, 245, 255)',
  blueLighter_40: 'rgba(168, 204, 255, 0.4)',
  blueLighter_40_on_white: 'rgb(220, 235, 255)',
  blueLighter_60: 'rgba(168, 204, 255, 0.6)',
  blueLighter_60_on_white: 'rgb(203, 224, 255)',
  blue_30: 'rgba(51, 160, 255, 0.3)',
  blue_30_on_white: 'rgb(192,226,255)',
  blue_60: 'rgba(51, 160, 255, 0.6)',
  blue_60_on_white: 'rgb(133,198,255)',
  brown_75: 'rgba(71, 31, 17, 0.75)',
  brown_75_on_white: 'rgb(117,87,78)',
  darkBlue: '#2645A3',
  darkBlue3: '#182D6E',
  darkBlue3_75: 'rgba(24, 45, 110, .75)',
  darkBlue3_75_on_white: 'rgb(82,98,147)',
  fastBlank: isIOS ? '#FFFFFF' : undefined, // on iOS overdraw is eliminiated if we use white, on Android it's eliminated if it's transparent /shrug
  green: '#37BD99',
  green2: '#0E8263',
  greenDark: '#289A72',
  greenDarker: '#1A7D5B',
  greenLight: '#B7EED9',
  greenLighter: '#E8FAF6',
  grey: '#E6E6E6',
  greyDark: '#CCCCCC',
  greyLight: '#F0F0F0',
  orange: '#FF6F21',
  orange_90: 'rgba(255, 111, 33, 0.9)',
  purple: '#845CDB',
  purpleDark: '#704EBA',
  purpleDarker: '#4D3285',
  purpleLight: '#9F7BEC',
  purpleLighter: '#E8DEFF',
  purple_01: 'rgba(132, 92, 219, 0.01)',
  purple_10: 'rgba(132, 92, 219, 0.1)',
  purple_40: 'rgba(132, 92, 219, 0.4)',
  red: '#FF4D61',
  redDark: '#D72236',
  redDarker: '#A5090E',
  redLight: '#FFCAC1',
  redLighter: '#FAF2ED',
  red_10: 'rgba(255,0,0,0.1)',
  red_20: 'rgba(255,0,0,0.2)',
  red_75: 'rgba(255,0,0,0.75)',
  red_75_on_white: 'rgb(255,64,64)',
  transparent: 'rgba(0, 0, 0, 0)',
  transparent_on_white: '#FFFFFF',
  white: '#FFFFFF',
  white_0: 'rgba(255, 255, 255, 0)',
  white_0_on_white: '#FFFFFF',
  white_20: 'rgba(255, 255, 255, 0.20)',
  white_20_on_white: '#FFFFFF',
  white_40: 'rgba(255, 255, 255, 0.40)',
  white_40_on_white: '#FFFFFF',
  white_75: 'rgba(255, 255, 255, 0.75)',
  white_75_on_white: '#FFFFFF',
  white_90: 'rgba(255, 255, 255, 0.90)',
  white_90_on_white: '#FFFFFF',
  yellow: '#FFF75A',
  yellowDark: '#FFB800',
  yellowGreen: '#A8CF36',
  yellowGreen2: '#94B52F',
  yellowLight: '#FFFDCC',
}

// console.log(
// 'aaa',
// Object.keys(colors)
// .map(name => {
// const val = colors[name]
// if (!val) return [name, val]

// const padZero = p => {
// const r = p.toString(16).toUpperCase()
// return r.length === 1 ? '0' + r : r
// }
// let r, g, b, a
// if (val[0] === '#') {
// r = parseInt(val[1] + val[2], 16)
// g = parseInt(val[3] + val[4], 16)
// b = parseInt(val[5] + val[6], 16)
// return [name, [>val,<] '#' + padZero(0xff - r) + padZero(0xff - g) + padZero(0xff - b)]
// } else if (val.startsWith('rgba')) {
// const s = val.indexOf('(') + 1
// const parts = val.substr(s).split(',')
// r = 255 - parseInt(parts[0], 10)
// g = 255 - parseInt(parts[1], 10)
// b = 255 - parseInt(parts[2], 10)
// a = parts[3].replace(')', '')
// return [name, [>val,<] `rgba(${r}, ${g}, ${b}, ${a})`]
// } else {
// const s = val.indexOf('(') + 1
// const parts = val.substr(s).split(',')
// r = 255 - parseInt(parts[0], 10)
// g = 255 - parseInt(parts[1], 10)
// b = 255 - parseInt(parts[2].replace(')', ''), 10)
// return [name, [>val,<] `rgb(${r}, ${g}, ${b})`]
// }
// })
// .reduce((s, arr) => {
// return s + `  ${arr[0]}: '${arr[1]}',\n`
// }, '')
// )

export const darkColors = {
  black: 'rgba(255, 255, 255,  0.85)',
  black_05: 'rgba(255, 255, 255,  0.05)',
  black_05_on_white: 'rgb(13, 13, 13)',
  black_10: 'rgba(255, 255, 255,  0.10)',
  black_10_on_white: 'rgb(26, 26, 26)',
  black_20: 'rgba(255, 255, 255,  0.20)',
  black_20_on_white: 'rgb(51, 51, 51)',
  black_35: 'rgba(255, 255, 255,  0.35)',
  black_40: 'rgba(255, 255, 255,  0.40)',
  black_50: 'rgba(255, 255, 255,  0.50)',
  black_50_on_white: 'rgb(128, 128, 128)',
  black_60: 'rgba(255, 255, 255,  0.60)',
  black_63: 'rgba(255, 255, 255,  0.63)',
  black_75: 'rgba(255, 255, 255,  0.75)',
  black_on_white: 'rgb(217, 217, 217)',
  blue: '#4C8EFF',
  blueDark: '#C99C15',
  blueDarker: '#EFC953',
  blueGrey: '#0D0B08',
  blueGreyDark: '#1F1709',
  blueLight: '#8C5900',
  blueLighter: '#573300',
  blueLighter2: '#140D03',
  blueLighter3: '#080603',
  blueLighter_20: 'rgba(87, 51, 0,  0.2)',
  blueLighter_20_on_white: 'rgb(17, 10, 0)',
  blueLighter_40: 'rgba(87, 51, 0,  0.4)',
  blueLighter_40_on_white: 'rgb(35, 20, 0)',
  blueLighter_60: 'rgba(87, 51, 0,  0.6)',
  blueLighter_60_on_white: 'rgb(52, 31, 0)',
  blue_30: 'rgba(204, 95, 0,  0.3)',
  blue_30_on_white: 'rgb(63, 29, 0)',
  blue_60: 'rgba(204, 95, 0,  0.6)',
  blue_60_on_white: 'rgb(122, 57, 0)',
  brown_75: 'rgba(184, 224, 238,  0.75)',
  brown_75_on_white: 'rgb(138, 168, 177)',
  darkBlue: '#D9BA5C',
  darkBlue3: '#E7D291',
  darkBlue3_75: 'rgba(231, 210, 145,  .75)',
  darkBlue3_75_on_white: 'rgb(173, 157, 108)',
  fastBlank: 'undefined',
  green: '#37BD99',
  green2: '#F17D9C',
  greenDark: '#D7658D',
  greenDarker: '#E582A4',
  greenLight: '#481126',
  greenLighter: '#170509',
  grey: '#191919',
  greyDark: '#333333',
  greyLight: '#0F0F0F',
  orange: '#0090DE',
  orange_90: 'rgba(0, 144, 222,  0.9)',
  purple: '#7BA324',
  purpleDark: '#8FB145',
  purpleDarker: '#B2CD7A',
  purpleLight: '#608413',
  purpleLighter: '#172100',
  purple_01: 'rgba(123, 163, 36,  0.01)',
  purple_10: 'rgba(123, 163, 36,  0.1)',
  purple_40: 'rgba(123, 163, 36,  0.4)',
  red: '#FF4D61',
  redDark: '#28DDC9',
  redDarker: '#5AF6F1',
  redLight: '#00353E',
  redLighter: '#050D12',
  red_10: 'rgba(0, 255, 255, 0.1)',
  red_20: 'rgba(0, 255, 255, 0.2)',
  red_75: 'rgba(0, 255, 255, 0.75)',
  red_75_on_white: 'rgb(0, 191, 191)',
  transparent: 'rgba(255, 255, 255,  0)',
  transparent_on_white: '#000000',
  white: '#000000',
  white_0: 'rgba(0, 0, 0,  0)',
  white_0_on_white: '#000000',
  white_20: 'rgba(0, 0, 0,  0.20)',
  white_20_on_white: '#000000',
  white_40: 'rgba(0, 0, 0,  0.40)',
  white_40_on_white: '#000000',
  white_75: 'rgba(0, 0, 0,  0.75)',
  white_75_on_white: '#000000',
  white_90: 'rgba(0, 0, 0,  0.90)',
  white_90_on_white: '#000000',
  yellow: '#0008A5',
  yellowDark: '#0047FF',
  yellowGreen: '#5730C9',
  yellowGreen2: '#6B4AD0',
  yellowLight: '#000233',
}

const wrapped = {
  get: function(target, prop) {
    return isDarkMode() ? darkColors[prop] : colors[prop]
  },
}

export const themed = new Proxy(colors, wrapped)
export default colors
