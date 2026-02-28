import * as React from 'react'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import * as Styles from '@/styles'
import type {Props} from './switch-toggle'

const SwitchToggle = (props: Props) => {
  const {on: _on} = props
  const getOffset = React.useCallback(() => (_on ? enabledOffset : disabledOffset), [_on])
  const [offset] = React.useState(new NativeAnimated.Value(getOffset()))
  const animationRef = React.useRef<NativeAnimated.CompositeAnimation | undefined>(undefined)

  React.useEffect(() => {
    animationRef.current?.stop()
    animationRef.current = NativeAnimated.timing(offset, {
      duration: 100,
      easing: NativeEasing.linear,
      toValue: getOffset(),
      useNativeDriver: false,
    })
    animationRef.current.start()
  }, [getOffset, offset])

  return (
    <NativeAnimated.View
      style={[
        styles.outer,
        {
          backgroundColor: offset.interpolate({
            inputRange: [disabledOffset, enabledOffset],
            outputRange: [
              Styles.undynamicColor(Styles.globalColors.greyDark),
              Styles.undynamicColor(Styles.globalColors[props.color]),
            ],
          }),
        },
        props.style,
      ]}
    >
      <NativeAnimated.View style={[styles.inner, {marginLeft: offset}]} />
    </NativeAnimated.View>
  )
}

const disabledOffset = 2
const enabledOffset = 22

const styles = Styles.styleSheetCreate(() => ({
  inner: {
    backgroundColor: Styles.undynamicColor(Styles.globalColors.white),
    borderRadius: 12,
    height: 24,
    width: 24,
  },
  outer: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 28,
    width: 48,
  },
}))

export default SwitchToggle
