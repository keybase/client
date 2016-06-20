// @flow
import {Spacing, getMuiTheme} from 'material-ui/styles'
import {globalColors, globalStyles} from './style-guide'

const base = {
  spacing: Spacing,
  fontFamily: globalStyles.fontRegular.fontFamily,
  palette: {
    primary1Color: globalColors.black_75,
    primary2Color: globalColors.black_75,
    primary3Color: globalColors.black_75,
    accent1Color: globalColors.black_75,
    accent2Color: globalColors.black_75,
    accent3Color: globalColors.black_75,
    textColor: globalColors.black_75,
    alternateTextColor: globalColors.black_75,
    canvasColor: globalColors.white,
    borderColor: globalColors.black_75,
    disabledColor: globalColors.black_75,
  },
}

const mui = getMuiTheme(base, mui)

// TODO endit sub properties here if you need to

export default mui
