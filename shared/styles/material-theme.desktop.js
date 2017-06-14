// @flow
import Spacing from 'material-ui/styles/spacing'
import getMuiTheme from 'material-ui/styles/getMuiTheme'
import {globalColors, globalStyles} from '.'

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
  userAgent: false,
}

const mui = getMuiTheme(base)

// TODO endit sub properties here if you need to

export default mui
