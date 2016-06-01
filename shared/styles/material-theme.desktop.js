// @flow

// Used to inject values into material classes w/o all the style overrides
//
// Example:
//
// class MyComponent extends Component {
//   getChildContext () {
//     return {
//       muiTheme: MaterialTheme
//     }
//   }
//
//
// MyComponent.childContextTypes = {
//   muiTheme: React.PropTypes.object
// }

import Spacing from 'material-ui/styles/spacing'
import {globalColors, globalStyles} from './style-guide'
import getMuiTheme from 'material-ui/styles/getMuiTheme'

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
    disabledColor: globalColors.black_75
  }
}

const mui = getMuiTheme(base, mui)

// TODO endit sub properties here if you need to

export default mui
