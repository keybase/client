import * as C from '@/constants'
import * as React from 'react'
import * as Styles from '@/styles'
import {Box2} from './box'
import {KeyboardAvoidingView2} from './keyboard-avoiding-view'
import Popup from './popup'
import {Animated as NativeAnimated, Easing as NativeEasing, useColorScheme} from 'react-native'
import type {Props} from './toast.shared'
import {colors, darkColors} from '@/styles/colors'
import './toast.css'

const Kb = {
  Box2,
  KeyboardAvoidingView2,
  Popup,
}

const positionFallbacks = [] as const

const Toast = (props: Props) => {
  const {visible} = props

  // Desktop state
  const [dismissedOnBlur, setDismissedOnBlur] = React.useState(false)
  const lastVisibleRef = React.useRef(visible)

  // Native state
  const [opacity] = React.useState(() => new NativeAnimated.Value(0))
  const [renderState, setRenderState] = React.useState(() => ({
    dismissedOnBlur: false,
    shouldRender: visible,
    visible,
  }))
  const isDarkMode = useColorScheme() === 'dark'

  let currentRenderState = renderState
  if (isMobile && currentRenderState.visible !== visible) {
    currentRenderState = {
      dismissedOnBlur: false,
      shouldRender: visible || currentRenderState.shouldRender,
      visible,
    }
    setRenderState(currentRenderState)
  }
  const {shouldRender} = currentRenderState

  React.useEffect(() => {
    if (isMobile) return undefined
    if (!visible || !lastVisibleRef.current) {
      setDismissedOnBlur(false)
    }
    lastVisibleRef.current = visible
  }, [visible])

  React.useEffect(() => {
    if (!isMobile) return undefined
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
    if (!isMobile) return undefined
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

  const onSafeFocusNative = React.useCallback(() => {
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

  const onSafeFocusDesktop = React.useCallback(() => {
    setDismissedOnBlur(false)
    return () => {
      setDismissedOnBlur(true)
    }
  }, [])

  C.Router2.useSafeFocusEffect(isMobile ? onSafeFocusNative : onSafeFocusDesktop)

  if (!isMobile) {
    return (
      <Popup
        attachTo={props.attachTo}
        propagateOutsideClicks={true}
        position={props.position}
        containerStyle={desktopStyles.float}
        offset={4}
        positionFallbacks={positionFallbacks}
      >
        <div
          className={Styles.classNames(
            {visible: visible && !dismissedOnBlur},
            props.className,
            'fadeBox'
          )}
          style={Styles.collapseStyles([desktopStyles.container, props.containerStyle]) as React.CSSProperties}
        >
          {props.children}
        </div>
      </Popup>
    )
  }

  return shouldRender ? (
    <Kb.Popup>
      <Kb.KeyboardAvoidingView2>
        <Kb.Box2 direction="vertical" pointerEvents="none" justifyContent="center" style={nativeStyles.wrapper}>
          <NativeAnimated.View
            style={[
              Styles.collapseStyles([
                nativeStyles.container,
                {
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

export default Toast

const desktopStyles = Styles.styleSheetCreate(() => ({
  container: Styles.platformStyles({
    isElectron: {
      alignItems: 'center',
      backgroundColor: Styles.globalColors.black,
      borderRadius: Styles.borderRadius,
      borderWidth: 0,
      justifyContent: 'center',
      margin: Styles.globalMargins.xtiny,
      paddingBottom: Styles.globalMargins.xtiny,
      paddingLeft: Styles.globalMargins.tiny,
      paddingRight: Styles.globalMargins.tiny,
      paddingTop: Styles.globalMargins.xtiny,
      pointerEvents: 'none',
      position: 'relative',
    },
  }),
  float: Styles.platformStyles({
    isElectron: {pointerEvents: 'none'},
  }),
}))

const nativeStyles = Styles.styleSheetCreate(() => ({
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
}))
