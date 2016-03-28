/* @flow */
// Styles from our designers

export {default as globalColors} from './style-guide-colors'

const util = {
  flexBoxColumn: {
    flexDirection: 'column'
  },
  flexBoxRow: {
    flexDirection: 'row'
  },
  flexBoxCenter: {
    justifyContent: 'center',
    alignItems: 'center'
  },
  rounded: {
    borderRadius: 3
  }
}

export const globalStyles = {
  ...util
}
