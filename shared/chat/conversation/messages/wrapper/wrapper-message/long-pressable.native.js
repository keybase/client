// @flow
import * as React from 'react'
import {NativeTouchableHighlight, NativeView} from '../../../../../common-adapters/mobile.native'

// See '.js.flow' for explanation
const LongPressable = (props: {children: React.Node}) => (
  <NativeTouchableHighlight>
    <NativeView>{props.children}</NativeView>
  </NativeTouchableHighlight>
)
export default LongPressable
