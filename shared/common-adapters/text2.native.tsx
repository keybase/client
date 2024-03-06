import * as React from 'react'
import type {Props} from './text2'
import type {Text as RNText} from 'react-native'

type RNTextProps = React.ComponentProps<typeof RNText>
const RCTText = (props: RNTextProps) => {
  const {onLongPress, onPress, onPressIn, onPressOut, ...p} = props
  return React.createElement('RCTText', p)
}

export const Text2 = React.memo(function Text2(p: Props) {
  const {type, style, children} = p
  console.log('aaa', children)
  return <RCTText style={style}>{children}</RCTText>
})
