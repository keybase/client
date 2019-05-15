// @flow

// Basically the same as React Native's text input, but the long press bug is
// fixed. Look at KBTextInput(Manager) in the android folder.

import React from 'react'
import {requireNativeComponent, Text, UIManager, TouchableWithoutFeedback} from 'react-native'
import {NativeTextInput as RNTextInput} from './native-wrappers.native'
import {isAndroid} from '../constants/platform'

let _KBTextInput = RNTextInput

if (isAndroid) {
  const NativeTextInput = requireNativeComponent('KBTextInput')
  class _NativeTextInputWrapper extends RNTextInput {
    render() {
      const props = Object.assign({}, this.props)

      props.style = [this.props.style]
      props.autoCapitalize =
        UIManager.AndroidTextInput.Constants.AutoCapitalizationType[props.autoCapitalize || 'sentences']
      /* $FlowFixMe(>=0.53.0 site=react_native_fb,react_native_oss) This comment
       * suppresses an error when upgrading Flow's support for React. To see the
       * error delete this comment and run Flow. */

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
          ref={this._setNativeRef}
          {...props}
          mostRecentEventCount={0}
          onFocus={this._onFocus}
          onBlur={this._onBlur}
          onChange={this._onChange}
          onSelectionChange={this._onSelectionChange}
          onTextInput={this._onTextInput}
          text={this.props.text || this.props.defaultValue || ''}
          children={children}
          disableFullscreenUI={this.props.disableFullscreenUI}
          textBreakStrategy={this.props.textBreakStrategy}
          onScroll={this._onScroll}
        />
      )

      return (
        <TouchableWithoutFeedback
          onLayout={props.onLayout}
          onPress={this._onPress}
          accessible={this.props.accessible}
          accessibilityLabel={this.props.accessibilityLabel}
          accessibilityRole={this.props.accessibilityRole}
          accessibilityStates={this.props.accessibilityStates}
          nativeID={this.props.nativeID}
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
