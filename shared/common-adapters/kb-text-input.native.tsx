/* eslint-disable flowtype/require-valid-file-annotation */

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

let _KBTextInput = RNTextInput

if (isAndroid) {
  const NativeTextInput = requireNativeComponent('KBTextInput')
  class _NativeTextInputWrapper extends RNTextInput {
    render() {
      // @ts-ignore no RN types
      const props = Object.assign({}, this.props)

      // @ts-ignore no RN types
      props.style = [this.props.style]
      props.autoCapitalize = UIManager.getViewManagerConfig(
        'AndroidTextInput'
      ).Constants.AutoCapitalizationType[props.autoCapitalize || 'sentences']
      /* $FlowFixMe(>=0.53.0 site=react_native_fb,react_native_oss) This comment
       * suppresses an error when upgrading Flow's support for React. To see the
       * error delete this comment and run Flow. */

      // @ts-ignore no RN types
      let children = this.props.children
      let childCount = 0
      React.Children.forEach(children, () => ++childCount)
      if (childCount > 1) {
        children = <Text>{children}</Text>
      }

      if (props.selection && props.selection.end == null) {
        props.selection = {
          end: props.selection.start,
          start: props.selection.start,
        }
      }

      const textContainer = (
        <NativeTextInput
          // @ts-ignore no RN types
          ref={this._setNativeRef}
          {...props}
          mostRecentEventCount={0}
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
          text={this.props.value || this.props.defaultValue || ''}
          children={children}
          // @ts-ignore no RN types
          disableFullscreenUI={this.props.disableFullscreenUI}
          // @ts-ignore no RN types
          textBreakStrategy={this.props.textBreakStrategy}
          // @ts-ignore no RN types
          onScroll={this._onScroll}
        />
      )

      return (
        <TouchableWithoutFeedback
          onLayout={props.onLayout}
          // @ts-ignore no RN types
          onPress={this._onPress}
          // @ts-ignore no RN types
          accessible={this.props.accessible}
          // @ts-ignore no RN types
          accessibilityLabel={this.props.accessibilityLabel}
          // @ts-ignore no RN types
          accessibilityRole={this.props.accessibilityRole}
          // @ts-ignore no RN types
          accessibilityStates={this.props.accessibilityStates}
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

  _KBTextInput = _NativeTextInputWrapper
}

const KBTextInput = _KBTextInput

export default KBTextInput
