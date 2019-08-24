import * as React from 'react'
import {
  KeyboardAvoidingView as RnKBAV,
  EmitterSubscription,
  StatusBarIOS,
  NativeModules,
  KeyboardAvoidingViewProps,
} from 'react-native'
import {isIPhoneX, isIOS} from '../constants/platform'
const {StatusBarManager} = NativeModules

class KeyboardAvoidingView extends React.Component<KeyboardAvoidingViewProps, {verticalOffset: number}> {
  _listener?: EmitterSubscription
  _mounted = true
  state = {verticalOffset: 0}

  componentWillMount() {
    if (isIOS) {
      StatusBarManager.getHeight(this.statusBarListener)
      this._listener = StatusBarIOS.addListener('statusBarFrameWillChange', (d: {frame: {height: number}}) =>
        this.statusBarListener(d.frame)
      )
    }
  }

  componentWillUnmount() {
    this._mounted = false
    this._listener && this._listener.remove()
  }

  private statusBarListener = (frameData: {height: number}) => {
    // the iPhone X has default status bar height of 45px
    // and it doesn't increase in height like earlier devices.
    // (so this should always be 0 on an iPhone X, but this should still
    // be correct if it expands)
    this._mounted && this.setState({verticalOffset: frameData.height - (isIPhoneX ? 45 : 20)})
  }

  render() {
    return (
      <RnKBAV
        {...this.props}
        keyboardVerticalOffset={this.state.verticalOffset + (this.props.keyboardVerticalOffset || 0)}
      />
    )
  }
}

export default KeyboardAvoidingView
