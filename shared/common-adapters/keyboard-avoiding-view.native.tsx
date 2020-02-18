// @ts-nocheck
import * as React from 'react'
import {
  KeyboardAvoidingView as RnKBAV,
  StatusBarIOS,
  NativeModules,
  LayoutAnimation,
  StyleSheet,
  KeyboardAvoidingViewProps,
  View,
} from 'react-native'
import {isIOS} from '../constants/platform'
const {StatusBarManager} = NativeModules

// port of built in but is split aware
class SplitAwareKeyboardAvoidingView extends RnKBAV {
  _onKeyboardChange = (event: any) => {
    if (event == null) {
      this.setState({bottom: 0})
      return
    }

    const {duration, easing, endCoordinates} = event
    const height = this._relativeKeyboardHeight(endCoordinates)

    if (this.state.bottom === height) {
      return
    }

    if (duration && easing) {
      LayoutAnimation.configureNext({
        // We have to pass the duration equal to minimal accepted duration defined here: RCTLayoutAnimation.m
        duration: duration > 10 ? duration : 10,
        update: {
          duration: duration > 10 ? duration : 10,
          type: LayoutAnimation.Types[easing] || 'keyboard',
        },
      })
    }
    this.setState({bottom: height})
  }

  render() {
    const {
      behavior,
      children,
      contentContainerStyle,
      enabled,
      keyboardVerticalOffset,
      style,
      ...props
    } = this.props
    const bottomHeight = enabled && !this.state.disabledDueToSplit ? this.state.bottom : 0
    switch (behavior) {
      case 'padding':
        return (
          <View
            ref={this.viewRef}
            style={StyleSheet.compose(style, {paddingBottom: bottomHeight})}
            onLayout={this._onLayout}
            {...props}
          >
            {children}
          </View>
        )
      default:
        return super.render()
    }
  }
}

const StatusbarAwareKeyboardAvoidingView = (p: KeyboardAvoidingViewProps) => {
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

  return (
    <SplitAwareKeyboardAvoidingView
      {...p}
      keyboardVerticalOffset={(p?.keyboardVerticalOffset ?? 0) + (isTwoLineStatusBar ? 20 : 0)}
    />
  )
}

export default StatusbarAwareKeyboardAvoidingView
