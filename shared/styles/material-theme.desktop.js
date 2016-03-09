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
    primary1Color: globalColors.black75,
    primary2Color: globalColors.black75,
    primary3Color: globalColors.black75,
    accent1Color: globalColors.black75,
    accent2Color: globalColors.black75,
    accent3Color: globalColors.black75,
    textColor: globalColors.black75,
    alternateTextColor: globalColors.black75,
    canvasColor: globalColors.white,
    borderColor: globalColors.black75,
    disabledColor: globalColors.black75
  }
}

const mui = ThemeManager.getMuiTheme(base, mui)

// TODO endit sub properties here if you need to

export default mui
