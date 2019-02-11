// @flow
import * as Kb from '../common-adapters/mobile.native'
import * as React from 'react'
import * as Styles from '../styles'
import * as Shared from './shim.shared'

export const shim = (routes: any) => Shared.shim(routes, shimNewRoute)

const shimNewRoute = (Original: any) => {
  // Wrap everything in a keyboard avoiding view (maybe this is opt in/out?)
  // Defer drawing until didfocus got called so transitions are faster
  class ShimmedNew extends React.PureComponent<any, {canDraw: boolean}> {
    static navigationOptions = Original.navigationOptions
    state = {canDraw: false}
    _didFocusSubscription = null
    _didFocus = () => {
      this.setState({canDraw: true})
      this._didFocusSubscription && this._didFocusSubscription.remove()
      this._didFocusSubscription = null
    }
    componentWillUnmount() {
      this._didFocusSubscription && this._didFocusSubscription.remove()
      this._didFocusSubscription = null
    }
    constructor(props) {
      super(props)
      this._didFocusSubscription = props.navigation.addListener('didFocus', this._didFocus)
    }
    render() {
      return this.state.canDraw ? (
        <Kb.NativeKeyboardAvoidingView style={styles.keyboard} behavior="padding">
          <Original {...this.props} />
        </Kb.NativeKeyboardAvoidingView>
      ) : null
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
