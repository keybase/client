// @flow
import {ScrollView} from 'react-native'

// Out of the box the ScrollView will consume taps of all children to dismiss the keyboard. This means if you have
// an input with focus and a button, tapping the button won't work until you click it twice. Setting these defaults
// changes this behavior: https://github.com/facebook/react-native/issues/4087
class BetterScrollView extends ScrollView {
  static defaultProps = {
    keybaseDismissMode: 'on-drag',
    keyboardShouldPersistTaps: 'handled',
  }
}

export default BetterScrollView
