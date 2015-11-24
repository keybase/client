import {StyleSheet} from '../base-react'
import native, {styles as nativeStyles} from './common.native'

const buttonHighlightCommon = {
  padding: 0,
  borderRadius: 2,
  backgroundColor: '#eeeeee',
  borderColor: 'blue'
}

const buttonCommon = {
  ...buttonHighlightCommon,
  padding: 10,
  textAlign: 'center',
  color: 'black'
}

const flexBox = {
  display: 'flex'
}

export const colors = {
  lightBlue: '#00BFF0',
  grey: 'grey',
  orange: '#FA855E',
  red: 'red',
  greyBackground: '#F7F7F6'
}

export default StyleSheet.create({
  button: {
    ...buttonCommon
  },
  buttonHighlight: {
    ...buttonHighlightCommon
  },
  disabledButtonHighlight: {
    ...buttonHighlightCommon
  },
  actionButton: {
    ...buttonCommon,
    backgroundColor: '#5E80FF'
  },
  disabledButton: {
    ...buttonCommon,
    color: '#777777',
    backgroundColor: '#999999',
    textDecorationLine: 'line-through'
  },
  error: {
    backgroundColor: 'red',
    color: 'black'
  },
  h1: {
    fontSize: 18
  },
  h2: {
    fontSize: 16
  },
  separator: {
    height: 1,
    backgroundColor: '#CCCCCC'
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
    padding: 4
  },
  greyText: {
    color: '#a6a6a6'
  },
  centerText: {
    textAlign: 'center'
  },
  flexBoxColumn: {
    ...flexBox,
    flexDirection: 'column'
  },
  flexBoxRow: {
    ...flexBox,
    flexDirection: 'row'
  },
  fontBold: {
    fontFamily: 'Noto Sans Bold'
  },
  fontItalic: {
    fontFamily: 'Noto Sans Italic'
  },
  noSelect: {
    WebkitUserSelect: 'none'
  },
  hr: {
    minHeight: 1,
    maxHeight: 1,
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  ...nativeStyles
})

// non stylesheet styles
export const buttonHighlight = 'white'
export const disabledButtonHighlight = 'black'
export const constants = native

