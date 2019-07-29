// Basically the same as React Native's text input, but the long press bug is
// fixed. Look at KBTextInput(Manager) in the android folder.

import React from 'react'
import {
  requireNativeComponent,
  Text,
  TextInput as RNTextInput,
  UIManager,
  TouchableWithoutFeedback,
} from 'react-native'
import {isAndroid} from '../constants/platform'

class KBInputText extends RNTextInput {
  private nativeTextInput = isAndroid ? requireNativeComponent('KBTextInput') : {}

  render() {
    // @ts-ignore we added this
    const {forwardRef} = this.props
    if (!isAndroid) {
      return <RNTextInput {...this.props} ref={forwardRef} />
    }
    const p = {
      ...this.props,
    }

    p.style = [this.props.style]
    // @ts-ignore TS doesn't know about this method
    p.autoCapitalize = UIManager.getViewManagerConfig('AndroidTextInput').Constants.AutoCapitalizationType[
      p.autoCapitalize || 'sentences'
    ]

    let children = p.children
    let childCount = 0
    React.Children.forEach(children, () => ++childCount)
    if (childCount > 1) {
      children = <Text>{children}</Text>
    }

    if (p.selection && p.selection.end == null) {
      p.selection = {
        end: p.selection.start,
        start: p.selection.start,
      }
    }

    const textContainer = (
      <this.nativeTextInput
        {...p}
        ref={forwardRef}
        mostRecentEventCount={0}
        text={p.value || p.defaultValue || ''}
        children={children}
        disableFullscreenUI={p.disableFullscreenUI}
        textBreakStrategy={p.textBreakStrategy}
      />
    )

    return (
      <TouchableWithoutFeedback
        onLayout={p.onLayout}
        accessible={p.accessible}
        accessibilityLabel={p.accessibilityLabel}
        accessibilityRole={p.accessibilityRole}
        accessibilityStates={p.accessibilityStates}
        testID={p.testID}
      >
        {textContainer}
      </TouchableWithoutFeedback>
    )
  }
}

export default (React.forwardRef<RNTextInput>((props, ref) => (
  // @ts-ignore
  <KBInputText {...props} forwardedRef={ref} />
)) as unknown) as typeof RNTextInput
