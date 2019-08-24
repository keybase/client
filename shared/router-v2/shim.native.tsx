import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'

export const shim = (routes: any) => Shared.shim(routes, shimNewRoute)

const shimNewRoute = (Original: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  class ShimmedNew extends React.PureComponent<any, void> {
    static navigationOptions = Original.navigationOptions
    render() {
      const navigationOptions =
        typeof Original.navigationOptions === 'function'
          ? Original.navigationOptions({navigation: this.props.navigation})
          : Original.navigationOptions
      const body = <Original {...this.props} />
      const keyboardBody = (
        <Kb.KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Styles.isIOS ? 'padding' : undefined}
          keyboardVerticalOffset={(navigationOptions && navigationOptions.headerHeight) || undefined}
        >
          {body}
        </Kb.KeyboardAvoidingView>
      )

      // don't make safe areas
      if (navigationOptions && navigationOptions.underNotch) {
        return keyboardBody
      }

      const safeKeyboardBody = (
        <Kb.NativeSafeAreaView style={styles.keyboard}>{keyboardBody}</Kb.NativeSafeAreaView>
      )

      return safeKeyboardBody
    }
  }
  return ShimmedNew
}
const styles = Styles.styleSheetCreate(() => ({
  keyboard: {
    backgroundColor: Styles.globalColors.white,
    flexGrow: 1,
    position: 'relative',
  },
}))
