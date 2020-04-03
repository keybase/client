import * as React from 'react'
import * as Styles from '../styles'
import FloatingBox from './floating-box'
import Box from './box'
import {useTimeout} from './use-timers'
import {NativeAnimated, NativeEasing} from './native-wrappers.native'
import {Props} from './toast'

const Kb = {
  Box,
  FloatingBox,
}

const noop = () => {}

const Toast = (props: Props) => {
  const {visible} = props
  const [shouldRender, setShouldRender] = React.useState(false)
  const opacityRef = React.useRef(new NativeAnimated.Value(0))
  const setShouldRenderFalseLater = useTimeout(() => {
    setShouldRender(false)
  }, 100)
  React.useEffect(() => {
    if (visible) {
      setShouldRender(true)
      const opacity = opacityRef.current
      return () => {
        NativeAnimated.timing(opacity, {
          duration: 100,
          easing: NativeEasing.linear,
          toValue: 0,
          useNativeDriver: false,
        }).start()
        setShouldRenderFalseLater()
      }
    }
    return noop
  }, [visible, setShouldRenderFalseLater, opacityRef])
  React.useEffect(() => {
    if (shouldRender) {
      const animation = NativeAnimated.timing(opacityRef.current, {
        duration: 100,
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
  }, [shouldRender])
  return shouldRender ? (
    <Kb.FloatingBox dest="keyboard-avoiding-root">
      <Kb.Box pointerEvents="none" style={styles.wrapper}>
        <NativeAnimated.View
          style={Styles.collapseStyles([
            styles.container,
            props.containerStyle,
            {opacity: opacityRef.current},
          ])}
        >
          {props.children}
        </NativeAnimated.View>
      </Kb.Box>
    </Kb.FloatingBox>
  ) : null
}

const styles = Styles.styleSheetCreate(() => ({
  container: {
    alignItems: 'center',
    backgroundColor: Styles.globalColors.black,
    borderRadius: 70,
    borderWidth: 0,
    display: 'flex',
    height: 140,
    justifyContent: 'center',
    margin: Styles.globalMargins.xtiny,
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
}))

export default Toast
