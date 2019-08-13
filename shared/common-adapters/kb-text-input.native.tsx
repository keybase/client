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

let KBInputText = RNTextInput

if (isAndroid) {
  const NativeTextInput = isAndroid ? requireNativeComponent('KBTextInput') : {}
  class _KBInputText extends RNTextInput {
    render() {
      // @ts-ignore we added this
      const {forwardedRef} = this.props
      if (!isAndroid) {
        return <RNTextInput {...this.props} ref={forwardedRef} />
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
        <NativeTextInput
          // @ts-ignore This neets
          ref={this._setNativeRef}
          {...p}
          mostRecentEventCount={0}
          text={p.value || p.defaultValue || ''}
          children={children}
          disableFullscreenUI={p.disableFullscreenUI}
          textBreakStrategy={p.textBreakStrategy}
          // @ts-ignore no RN types
          onFocus={this._onFocus}
          // @ts-ignore no RN types
          onBlur={this._onBlur}
          // @ts-ignore no RN types
          onChange={this._onChange}
          // @ts-ignore no RN types
          onSelectionChange={this._onSelectionChange}
          // @ts-ignore no RN types
          onTextInput={this._onTextInput}
          // @ts-ignore no RN types
          onScroll={this._onScroll}
        />
      )

      return (
        // @ts-ignore
        <TouchableWithoutFeedback
          onLayout={p.onLayout}
          accessible={p.accessible}
          accessibilityLabel={p.accessibilityLabel}
          // @ts-ignore
          onPress={this._onPress}
          accessibilityRole={p.accessibilityRole}
          accessibilityStates={p.accessibilityStates}
          // @ts-ignore no RN types
          nativeID={this.props.nativeID}
          // @ts-ignore no RN types
          testID={this.props.testID}
        >
          {textContainer}
        </TouchableWithoutFeedback>
      )
    }
  }
  KBInputText = _KBInputText
}

export default (KBInputText as unknown) as typeof RNTextInput
