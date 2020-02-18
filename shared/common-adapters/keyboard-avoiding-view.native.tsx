import * as React from 'react'
import {
  KeyboardAvoidingView as RnKBAV,
  StatusBarIOS,
  NativeModules,
  KeyboardAvoidingViewProps,
} from 'react-native'
import {isIOS} from '../constants/platform'

const {StatusBarManager} = NativeModules

const KeyboardAvoidingView = (p: KeyboardAvoidingViewProps) => {
  const [statusBarHeight, setStatusBarHeight] = React.useState(0)
  const isTwoLineStatusBar = statusBarHeight === 40
  React.useEffect(() => {
    if (!isIOS) {
      return
    }

    StatusBarManager.getHeight((response: any) => setStatusBarHeight(response.height))

    const listener = StatusBarIOS.addListener('statusBarFrameWillChange', statusBarData => {
      setStatusBarHeight(statusBarData.frame.height)
    })

    return () => listener.remove()
  }, [])

  return <RnKBAV {...p} keyboardVerticalOffset={isTwoLineStatusBar ? 20 : 0} />
}

export default KeyboardAvoidingView
