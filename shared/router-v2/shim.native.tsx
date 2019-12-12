import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'
import * as Container from '../util/container'

export const shim = (routes: any) => Shared.shim(routes, shimNewRoute)

const KeyboardAvoidingViewWithHeaderHeight = ({useHeaderHeight, children}) => {
  const headerHeight = useHeaderHeight()
  return (
    <Kb.KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Styles.isIOS ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {children}
    </Kb.KeyboardAvoidingView>
  )
}

const KeyboardAvoidingViewWithoutHeaderHeight = ({children}) => (
  <Kb.KeyboardAvoidingView style={styles.keyboard} behavior={Styles.isIOS ? 'padding' : undefined}>
    {children}
  </Kb.KeyboardAvoidingView>
)

const shimNewRoute = (Original: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  // Also light/dark aware
  class ShimmedNew extends React.PureComponent<any, void> {
    static navigationOptions = Original.navigationOptions
    render() {
      const navigationOptions =
        typeof Original.navigationOptions === 'function'
          ? Original.navigationOptions({navigation: this.props.navigation})
          : Original.navigationOptions
      const body = <Original {...this.props} key={this.props.isDarkMode ? 'dark' : 'light'} />
      const keyboardBody =
        navigationOptions && navigationOptions.useHeaderHeight ? (
          <KeyboardAvoidingViewWithHeaderHeight useHeaderHeight={navigationOptions.useHeaderHeight}>
            {body}
          </KeyboardAvoidingViewWithHeaderHeight>
        ) : (
          <KeyboardAvoidingViewWithoutHeaderHeight>{body}</KeyboardAvoidingViewWithoutHeaderHeight>
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
  return Container.connect(
    () => ({isDarkMode: Styles.isDarkMode()}),
    undefined,
    (s, _, o: Object) => ({
      ...s,
      ...o,
    })
    // @ts-ignore
  )(ShimmedNew)
}
const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        backgroundColor: Styles.globalColors.fastBlank,
        flexGrow: 1,
        position: 'relative',
      },
    } as const)
)
