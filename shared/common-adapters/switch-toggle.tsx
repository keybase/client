import * as React from 'react'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import * as Styles from '@/styles'

type Props = {
  color: 'green' | 'blue' | 'red'
  on: boolean
  style?: Styles.StylesCrossPlatform
}

const nativeDisabledOffset = 2
const nativeEnabledOffset = 22
const desktopDisabledOffset = 2
const desktopEnabledOffset = 10

const desktopInnerStyle: React.CSSProperties = {
  backgroundColor: Styles.globalColors.white,
  borderRadius: 6,
  ...Styles.size(12),
}

const SwitchToggle = (props: Props) => {
  const {on: _on} = props
  const [offset] = React.useState(
    new NativeAnimated.Value(_on ? nativeEnabledOffset : nativeDisabledOffset)
  )
  const animationRef = React.useRef<NativeAnimated.CompositeAnimation | undefined>(undefined)

  React.useEffect(() => {
    if (!isMobile) return
    animationRef.current?.stop()
    animationRef.current = NativeAnimated.timing(offset, {
      duration: 100,
      easing: NativeEasing.linear,
      toValue: _on ? nativeEnabledOffset : nativeDisabledOffset,
      useNativeDriver: false,
    })
    animationRef.current.start()
  }, [_on, offset])

  if (!isMobile) {
    const outerStyle: React.CSSProperties = {
      ...Styles.globalStyles.flexBoxRow,
      alignItems: 'center',
      backgroundColor: _on ? Styles.globalColors[props.color] : Styles.globalColors.greyDark,
      borderRadius: 8,
      flexShrink: 0,
      height: 16,
      paddingLeft: _on ? desktopEnabledOffset : desktopDisabledOffset,
      transition: 'all 100ms ease-in-out',
      width: 24,
    }
    return (
      <div style={outerStyle}>
        <div style={desktopInnerStyle} />
      </div>
    )
  }

  return (
    <NativeAnimated.View
      style={[
        styles.nativeOuter,
        {
          backgroundColor: offset.interpolate({
            inputRange: [nativeDisabledOffset, nativeEnabledOffset],
            outputRange: [
              Styles.undynamicColor(Styles.globalColors.greyDark),
              Styles.undynamicColor(Styles.globalColors[props.color]),
            ],
          }),
        },
        props.style,
      ]}
    >
      <NativeAnimated.View style={[styles.nativeInner, {marginLeft: offset}]} />
    </NativeAnimated.View>
  )
}

const styles = Styles.styleSheetCreate(() => ({
  nativeInner: {
    backgroundColor: Styles.undynamicColor(Styles.globalColors.white),
    borderRadius: 12,
    ...Styles.size(24),
  },
  nativeOuter: {
    ...Styles.globalStyles.flexBoxRow,
    alignItems: 'center',
    borderRadius: 14,
    flexShrink: 0,
    height: 28,
    width: 48,
  },
}))

export default SwitchToggle
