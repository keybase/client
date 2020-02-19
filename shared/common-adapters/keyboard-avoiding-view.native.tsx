// @ts-nocheck
/* eslint-disable */
import * as React from 'react'
import {
  StatusBarIOS,
  NativeModules,
  LayoutAnimation,
  StyleSheet,
  Keyboard,
  KeyboardAvoidingViewProps,
  View,
} from 'react-native'
import {isIOS} from '../constants/platform'
const {StatusBarManager} = NativeModules

class SplitAwareKeyboardAvoidingView extends React.Component<KeyboardAvoidingViewProps, State> {
  static defaultProps = {
    enabled: true,
    keyboardVerticalOffset: 0,
  }

  _frame = null
  _subscriptions = []
  viewRef = null
  _initialFrameHeight = 0

  constructor(props: Props) {
    super(props)
    // KB: added
    this.state = {bottom: 0, disabledDueToSplit: false}
    // KB: end added
    this.viewRef = React.createRef()
  }

  _relativeKeyboardHeight(keyboardFrame) {
    const frame = this._frame
    if (!frame || !keyboardFrame) {
      return 0
    }

    const keyboardY = keyboardFrame.screenY - this.props.keyboardVerticalOffset

    // Calculate the displacement needed for the view such that it
    // no longer overlaps with the keyboard
    return Math.max(frame.y + frame.height - keyboardY, 0)
  }

  _onKeyboardChange = event => {
    if (event == null) {
      this.setState({bottom: 0})
      return
    }

    const {duration, easing, endCoordinates} = event

    // KB: added split?
    if (this._frame && endCoordinates.width !== this._frame.width) {
      this.setState({disabledDueToSplit: true})
    } else {
      if (this.state.disabledDueToSplit) {
        this.setState({disabledDueToSplit: false})
      }
    }
    // KB: end added

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

  _onLayout = event => {
    this._frame = event.nativeEvent.layout
    if (!this._initialFrameHeight) {
      // save the initial frame height, before the keyboard is visible
      this._initialFrameHeight = this._frame.height
    }
  }

  componentDidMount(): void {
    if (Platform.OS === 'ios') {
      this._subscriptions = [Keyboard.addListener('keyboardWillChangeFrame', this._onKeyboardChange)]
    } else {
      this._subscriptions = [
        Keyboard.addListener('keyboardDidHide', this._onKeyboardChange),
        Keyboard.addListener('keyboardDidShow', this._onKeyboardChange),
      ]
    }
  }

  componentWillUnmount(): void {
    this._subscriptions.forEach(subscription => {
      subscription.remove()
    })
  }

  render(): React.Node {
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
      case 'height':
        let heightStyle
        if (this._frame != null && this.state.bottom > 0) {
          // Note that we only apply a height change when there is keyboard present,
          // i.e. this.state.bottom is greater than 0. If we remove that condition,
          // this.frame.height will never go back to its original value.
          // When height changes, we need to disable flex.
          heightStyle = {
            height: this._initialFrameHeight - bottomHeight,
            flex: 0,
          }
        }
        return (
          <View
            ref={this.viewRef}
            style={StyleSheet.compose(style, heightStyle)}
            onLayout={this._onLayout}
            {...props}
          >
            {children}
          </View>
        )

      case 'position':
        return (
          <View ref={this.viewRef} style={style} onLayout={this._onLayout} {...props}>
            <View
              style={StyleSheet.compose(contentContainerStyle, {
                bottom: bottomHeight,
              })}
            >
              {children}
            </View>
          </View>
        )

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
        return (
          <View ref={this.viewRef} onLayout={this._onLayout} style={style} {...props}>
            {children}
          </View>
        )
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
