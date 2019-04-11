// @flow
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
      const body = <Original {...this.props} />
      const keyboardBody = (
        <Kb.NativeKeyboardAvoidingView
          style={styles.keyboard}
          behavior={Styles.isIOS ? 'padding' : undefined}
        >
          {body}
        </Kb.NativeKeyboardAvoidingView>
      )

      // don't make safe areas
      if (Original.navigationOptions && Original.navigationOptions.underNotch) {
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
const styles = Styles.styleSheetCreate({
  keyboard: {
    flexGrow: 1,
    position: 'relative',
  },
})
