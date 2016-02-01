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
    primary1Color: globalColors.grey1,
    primary2Color: globalColors.grey1,
    primary3Color: globalColors.grey1,
    accent1Color: globalColors.grey1,
    accent2Color: globalColors.grey1,
    accent3Color: globalColors.grey1,
    textColor: globalColors.grey1,
    alternateTextColor: globalColors.grey1,
    canvasColor: globalColors.white,
    borderColor: globalColors.grey3,
    disabledColor: globalColors.grey3
  }
}

const mui = ThemeManager.getMuiTheme(base, mui)

// TODO endit sub properties here if you need to

export default mui
