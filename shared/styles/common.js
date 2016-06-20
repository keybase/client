/* @flow */
import native, {styles as nativeStyles, sheet} from './common.native'

const buttonHighlightCommon = {
  padding: 0,
  borderRadius: 2,
  backgroundColor: '#eeeeee',
  borderColor: 'blue',
}

const buttonCommon = {
  ...buttonHighlightCommon,
  padding: 10,
  textAlign: 'center',
  color: 'black',
}

export const colors = {
  black: '#333333',
  grey: 'grey',
  grey80: '#cccccc',
  grey65: '#a6a6a6',
  warmGrey: '#777777',
  paleGrey: '#ebf0f5',
  transparentGrey: 'rgba(68, 68, 68, 0.10)',
  greyBackground: '#f7f7f6',
  white: '#f6f6f4',
  trueWhite: '#ffffff',
  lightBlue: '#00bff0',
  orange: '#fa855e',
  red: 'red',
  freshGreen: '#90d05c',
  robinsEggBlue: '#86e2f9',
  lightTeal: '#8ad2e6',
  error: '#d0021b',
  backgroundBlue: '#20C0EE',
  codeBackground: '#F6F6F4',
  darkGreyBackground: '#444444',
}

const buttons = {
  button: {
    ...buttonCommon,
  },
  buttonHighlight: {
    ...buttonHighlightCommon,
  },
  disabledButtonHighlight: {
    ...buttonHighlightCommon,
  },
  actionButton: {
    ...buttonCommon,
    backgroundColor: '#5E80FF',
  },
  disabledButton: {
    ...buttonCommon,
    color: colors.warmGrey,
    backgroundColor: '#999999',
    textDecorationLine: 'line-through',
  },
}

export default sheet({
  ...buttons,
  error: {
    backgroundColor: 'red',
    color: 'black',
  },
  h1: {
    fontSize: 18,
  },
  h2: {
    fontSize: 16,
  },
  separator: {
    height: 1,
    backgroundColor: colors.grey80,
  },
  textInput: {
    borderColor: '#0f0f0f',
    borderRadius: 2,
    borderWidth: 0.5,
    fontSize: 13,
    height: 40,
    marginBottom: 5,
    marginLeft: 10,
    marginRight: 10,
    padding: 4,
  },
  greyText: {
    color: colors.grey65,
  },
  centerText: {
    textAlign: 'center',
  },
  transparentBlack: {
    color: colors.black,
    opacity: 0.6,
  },
  ...nativeStyles,
})

// non stylesheet styles
export const buttonHighlight = 'white'
export const disabledButtonHighlight = 'black'
export const constants = native

export type Styled = {
  style: Object
}
