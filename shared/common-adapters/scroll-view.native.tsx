import * as React from 'react'
import {ScrollView, type ScrollViewProps} from 'react-native'
import type {ScrollViewRef} from './scroll-view.shared'
// Out of the box the ScrollView will consume taps of all children to dismiss the keyboard. This means if you have
// an input with focus and a button, tapping the button won't work until you click it twice. Setting these defaults
// changes this behavior: https://github.com/facebook/react-native/issues/4087

function BetterScrollView(props: ScrollViewProps & {ref?: React.Ref<ScrollViewRef>}) {
  const {ref: outerRef, ...rest} = props
  const innerRef = React.useRef<ScrollView>(null)
  React.useImperativeHandle(outerRef, () => ({
    scrollTo: (args: {x: number; y: number; animated?: boolean}) => innerRef.current?.scrollTo(args),
    scrollToEnd: (opts: {animated?: boolean; duration?: number}) => innerRef.current?.scrollToEnd(opts),
  }))
  const keyboardShouldPersistTaps = rest.keyboardShouldPersistTaps ?? 'handled'
  const contentInsetAdjustmentBehavior = rest.contentInsetAdjustmentBehavior ?? 'automatic'
  return (
    <ScrollView
      ref={innerRef}
      {...rest}
      contentInsetAdjustmentBehavior={contentInsetAdjustmentBehavior}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      overScrollMode="never"
    />
  )
}

export default BetterScrollView
