import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import {KeyboardAvoidingView2} from './keyboard-avoiding-view'
import Popup from './popup'
import {Animated as NativeAnimated, Easing as NativeEasing} from 'react-native'
import type {Props} from './toast'
import {colors, darkColors} from '@/styles/colors'
import {useColorScheme} from 'react-native'

const Kb = {
  Box2,
  KeyboardAvoidingView2,
  Popup,
}

const Toast = (props: Props) => {
  const {visible} = props
  const [opacity] = React.useState(() => new NativeAnimated.Value(0))
  const [renderState, setRenderState] = React.useState(() => ({
    dismissedOnBlur: false,
    shouldRender: visible,
    visible,
  }))

  let currentRenderState = renderState
  if (currentRenderState.visible !== visible) {
    currentRenderState = {
      dismissedOnBlur: false,
      shouldRender: visible || currentRenderState.shouldRender,
      visible,
    }
    setRenderState(currentRenderState)
  }
  const {shouldRender} = currentRenderState

  React.useEffect(() => {
    if (!shouldRender) {
      return undefined
    }
    const animation = NativeAnimated.timing(opacity, {
      duration: 200,
      easing: NativeEasing.linear,
      toValue: visible ? 1 : 0,
      useNativeDriver: false,
    })
    animation.start()
    return () => {
      animation.stop()
    }
  }, [opacity, shouldRender, visible])

  React.useEffect(() => {
    if (visible || !shouldRender) {
      return undefined
    }
    const id = setTimeout(() => {
      setRenderState(state =>
        state.visible || !state.shouldRender ? state : {...state, shouldRender: false}
      )
    }, 1000)
    return () => {
      clearTimeout(id)
    }
  }, [shouldRender, visible])

  const onSafeFocus = React.useCallback(() => {
    setRenderState(state =>
      state.dismissedOnBlur
        ? {...state, dismissedOnBlur: false, shouldRender: state.visible || state.shouldRender}
        : state
    )
    return () => {
      setRenderState(state =>
        state.shouldRender || !state.dismissedOnBlur
          ? {...state, dismissedOnBlur: true, shouldRender: false}
          : state
      )
    }
  }, [])

  // since this uses portals we need to hide if we're hidden else we can get stuck showing if our render is frozen
  C.Router2.useSafeFocusEffect(onSafeFocus)

  const isDarkMode = useColorScheme() === 'dark'

  return shouldRender ? (
    <Kb.Popup>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box2 direction="vertical" pointerEvents="none" justifyContent="center" style={styles.wrapper}>
          <NativeAnimated.View
            style={[
              Styles.collapseStyles([
                styles.container,
                {
                  // RN bugs with animated dynamicColors so have to use the raw ones
                  // known bug this won't work if the dark mode changes dynamic on ios currently
                  backgroundColor: isDarkMode ? darkColors.black : colors.black,
                },
                props.containerStyle,
              ]),
              {opacity},
            ]}
          >
            {props.children}
          </NativeAnimated.View>
        </Kb.Box2>
      </Kb.KeyboardAvoidingView2>
    </Kb.Popup>
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
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  }
})

export default Toast
