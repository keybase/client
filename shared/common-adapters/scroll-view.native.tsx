import * as React from 'react'
import {ScrollView, type ScrollViewProps} from 'react-native'
// Out of the box the ScrollView will consume taps of all children to dismiss the keyboard. This means if you have
// an input with focus and a button, tapping the button won't work until you click it twice. Setting these defaults
// changes this behavior: https://github.com/facebook/react-native/issues/4087

const BetterScrollView = React.forwardRef<ScrollView, ScrollViewProps>(function BetterScrollView(props, ref) {
  const keyboardShouldPersistTaps = props.keyboardShouldPersistTaps ?? 'handled'
  return (
    <ScrollView
      ref={ref}
      {...props}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      overScrollMode="never"
    />
  )
}) as any

export default BetterScrollView
