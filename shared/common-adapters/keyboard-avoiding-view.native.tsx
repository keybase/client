import * as Styles from '@/styles'
import {
  AccessibilityInfo,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  StyleSheet,
  View,
  type EventSubscription,
  type KeyboardAvoidingView as OldKeyboardAvoidingViewType,
  type KeyboardEvent,
  type LayoutChangeEvent,
  type ViewStyle,
} from 'react-native'
import {useHeaderHeight} from '@react-navigation/elements'
import type {Props as KAVProps} from './keyboard-avoiding-view'
import * as React from 'react'
import {getKeyboardUp} from '@/styles/keyboard-state'
import {isTablet} from '@/constants/platform'

type Props = React.ComponentProps<typeof OldKeyboardAvoidingViewType> & {
  extraPadding?: number
  compensateNotBeingOnBottom?: boolean
}

type ViewLayout = {
  x: number
  y: number
  width: number
  height: number
}

type KeyboardMetrics = {
  screenX: number
  screenY: number
  width: number
  height: number
}

const useSafeHeaderHeight = () => {
  try {
    return useHeaderHeight()
  } catch {
    return 0
  }
}

type State = {
  bottom: number
}

// Pulling this from RN since we patch it up
class KeyboardAvoidingView extends React.Component<Props, State> {
  _bottom: number = 0
  _frame?: ViewLayout
  _keyboardEvent?: KeyboardEvent | undefined
  _subscriptions: Array<EventSubscription> = []
  viewRef: {current: React.ElementRef<typeof View> | null}
  _initialFrameHeight: number = 0
  _tabletLayoutHeight: number = 0

  constructor(props: Props) {
    super(props)
    this.state = {bottom: 0}
    this.viewRef = React.createRef()
  }

  async _relativeKeyboardHeight(keyboardFrame: KeyboardMetrics): Promise<number> {
    const frame = this._frame
    if (!frame) {
      return 0
    }

    // On iOS when Prefer Cross-Fade Transitions is enabled, the keyboard position
    // & height is reported differently (0 instead of Y position value matching height of frame)
    if (
      Platform.OS === 'ios' &&
      keyboardFrame.screenY === 0 &&
      (await AccessibilityInfo.prefersCrossFadeTransitions())
    ) {
      return 0
    }

    const keyboardY = keyboardFrame.screenY - (this.props.keyboardVerticalOffset ?? 0)

    if (this.props.behavior === 'height') {
      return Math.max(this.state.bottom + frame.y + frame.height - keyboardY, 0)
    }

    // just use the keyboard height
    // showing?
    const windowHeight = Dimensions.get('window').height
    if (keyboardFrame.screenY + keyboardFrame.height === windowHeight) {
      return keyboardFrame.height
    }
    return 0

    // Calculate the displacement needed for the view such that it
    // no longer overlaps with the keyboard
    // return Math.max(frame.y + frame.height - keyboardY, 0)
  }

  _onKeyboardChange = (event?: KeyboardEvent) => {
    this._keyboardEvent = event
    this._updateBottomIfNecessary()
      .then(() => {})
      .catch(() => {})
  }

  _onLayout = (event: LayoutChangeEvent) => {
    if (isTablet) {
      this._tabletLayoutHeight = (Dimensions.get('window').height - event.nativeEvent.layout.height) / 2
    }
    const f = async () => {
      const wasFrameNull = !this._frame
      this._frame = event.nativeEvent.layout
      if (!this._initialFrameHeight) {
        // save the initial frame height, before the keyboard is visible
        this._initialFrameHeight = this._frame.height
      }

      if (wasFrameNull) {
        await this._updateBottomIfNecessary()
      }

      if (this.props.onLayout) {
        this.props.onLayout(event)
      }
    }
    f()
      .then(() => {})
      .catch(() => {})
  }

  // Avoid unnecessary renders if the KeyboardAvoidingView is disabled.
  _setBottom = (value: number) => {
    const enabled = this.props.enabled ?? true
    this._bottom = value
    if (enabled) {
      this.setState({bottom: value + (this.props.extraPadding ?? 0)})
    }
  }

  _updateBottomIfNecessary = async () => {
    if (!this._keyboardEvent) {
      this._setBottom(0)

      if (getKeyboardUp()) {
        const h = Keyboard.metrics()?.height ?? 0
        this._setBottom(h)
      } else {
        this._setBottom(0)
      }
      return
    }

    const {duration, easing: _easing, endCoordinates} = this._keyboardEvent
    const easing = _easing as typeof _easing | undefined // i think this is possible...
    const height = await this._relativeKeyboardHeight(endCoordinates)

    if (this._bottom === height) {
      return
    }

    const enabled = this.props.enabled ?? true
    if (enabled && duration && easing) {
      LayoutAnimation.configureNext({
        // We have to pass the duration equal to minimal accepted duration defined here: RCTLayoutAnimation.m
        duration: duration > 10 ? duration : 10,
        update: {
          duration: duration > 10 ? duration : 10,
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          type: LayoutAnimation.Types[easing] || 'keyboard',
        },
      })
    }

    // tablet modals are centered so we need to offset that, zero otherwise
    const bottomOffset = this.props.compensateNotBeingOnBottom ? this._tabletLayoutHeight : 0
    this._setBottom(height - bottomOffset)
  }

  // componentDidUpdate(_: Props, prevState: State): void {
  // const enabled = this.props.enabled ?? true
  // if (enabled && this._bottom !== prevState.bottom) {
  //   this.setState({bottom: this._bottom})
  // }
  // }

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

  render(): React.ReactNode {
    const {
      behavior,
      children,
      contentContainerStyle,
      enabled = true,
      // keyboardVerticalOffset = 0,
      style,
      onLayout,
      ...props
    } = this.props
    const bottomHeight = enabled ? this.state.bottom : 0
    switch (behavior) {
      case 'height': {
        let heightStyle: ViewStyle | undefined
        if (!!this._frame && this.state.bottom > 0) {
          // Note that we only apply a height change when there is keyboard present,
          // i.e. this.state.bottom is greater than 0. If we remove that condition,
          // this.frame.height will never go back to its original value.
          // When height changes, we need to disable flex.
          heightStyle = {
            flex: 0,
            height: this._initialFrameHeight - bottomHeight,
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
      }
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

const styles = Styles.styleSheetCreate(
  () =>
    ({
      keyboard: {
        flexGrow: 1,
        maxHeight: '100%',
        position: 'relative',
      },
    }) as const
)

export const KeyboardAvoidingView2 = (p: KAVProps) => {
  const {children, extraOffset, extraPadding, compensateNotBeingOnBottom} = p
  const headerHeight = useSafeHeaderHeight()
  const keyboardVerticalOffset = headerHeight + (extraOffset ?? 0)

  return (
    <KeyboardAvoidingView
      compensateNotBeingOnBottom={compensateNotBeingOnBottom}
      keyboardVerticalOffset={keyboardVerticalOffset}
      pointerEvents="box-none"
      style={styles.keyboard}
      extraPadding={extraPadding}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {children}
    </KeyboardAvoidingView>
  )
}
