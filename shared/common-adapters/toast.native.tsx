import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import FloatingBox from './floating-box'
import Box from './box'
import {KeyboardAvoidingView2} from './keyboard-avoiding-view'
import {useTimeout} from './use-timers'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import type {Props} from './toast'
import {colors, darkColors} from '@/styles/colors'
import noop from 'lodash/noop'
import {useColorScheme} from 'react-native'

const Kb = {
  Box,
  FloatingBox,
  KeyboardAvoidingView2,
}

const Toast = (props: Props) => {
  const {visible} = props
  const [shouldRender, setShouldRender] = React.useState(false)
  const opacityRef = React.useRef(new NativeAnimated.Value(0))
  const [opacity, setOpacity] = React.useState<NativeAnimated.Value | undefined>(undefined)
  React.useEffect(() => {
    setOpacity(opacityRef.current)
  }, [])
  const setShouldRenderFalseLater = useTimeout(() => {
    setShouldRender(false)
  }, 1000)
  React.useEffect(() => {
    if (visible) {
      setShouldRender(true)
      return () => {
        opacity &&
          NativeAnimated.timing(opacity, {
            duration: 200,
            easing: NativeEasing.linear,
            toValue: 0,
            useNativeDriver: false,
          }).start()
        setShouldRenderFalseLater()
      }
    }
    return noop
  }, [visible, setShouldRenderFalseLater, opacity])
  React.useEffect(() => {
    if (shouldRender && opacity) {
      const animation = NativeAnimated.timing(opacity, {
        duration: 200,
        easing: NativeEasing.linear,
        toValue: 1,
        useNativeDriver: false,
      })
      animation.start()
      return () => {
        animation.stop()
      }
    }
    return noop
  }, [shouldRender, opacity])

  // since this uses portals we need to hide if we're hidden else we can get stuck showing if our render is frozen
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      return () => {
        setShouldRender(false)
      }
    }, [])
  )

  const isDarkMode = useColorScheme() === 'dark'

  return shouldRender ? (
    <Kb.FloatingBox>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box pointerEvents="none" style={styles.wrapper}>
          <NativeAnimated.View
            style={Styles.collapseStyles([
              styles.container,
              {
                // RN bugs with animated dynamicColors so have to use the raw ones
                // known bug this won't work if the dark mode changes dynamic on ios currently
                backgroundColor: isDarkMode ? darkColors.black : colors.black,
              },
              props.containerStyle,
              {opacity: (opacity as number | undefined) ?? 0},
            ])}
          >
            {props.children}
          </NativeAnimated.View>
        </Kb.Box>
      </Kb.KeyboardAvoidingView2>
    </Kb.FloatingBox>
  ) : null
}

const styles = Styles.styleSheetCreate(() => {
  return {
    container: {
      alignItems: 'center',
      borderRadius: 140,
      borderWidth: 0,
      display: 'flex',
      height: 140,
      justifyContent: 'center',
      margin: Styles.globalMargins.xtiny,
      overflow: 'hidden',
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
      width: 140,
    },
    wrapper: {
      alignItems: 'center',
      bottom: 0,
      justifyContent: 'center',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }
})

export default Toast
