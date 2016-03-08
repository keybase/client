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

import Spacing from 'material-ui/lib/styles/spacing'
import {globalColors, globalStyles} from './style-guide'
import ThemeManager from 'material-ui/lib/styles/theme-manager'

const base = {
  spacing: Spacing,
  fontFamily: globalStyles.fontRegular.fontFamily,
  palette: {
    primary1Color: globalColors.lightGrey,
    primary2Color: globalColors.lightGrey,
    primary3Color: globalColors.lightGrey,
    accent1Color: globalColors.lightGrey,
    accent2Color: globalColors.lightGrey,
    accent3Color: globalColors.lightGrey,
    textColor: globalColors.lightGrey,
    alternateTextColor: globalColors.lightGrey,
    canvasColor: globalColors.white,
    borderColor: globalColors.lightGrey3,
    disabledColor: globalColors.lightGrey3
  }
}

const mui = ThemeManager.getMuiTheme(base, mui)

// TODO endit sub properties here if you need to

export default mui
