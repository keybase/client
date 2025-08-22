import * as C from '@/constants'
import * as React from 'react'
import {Portal} from './portal.native'
import {useTimeout} from './use-timers'
import Box from './box'
import ClickableBox from './clickable-box'
import Text from './text'
import * as Styles from '@/styles'
import type {Props} from './with-tooltip'
import {View, useWindowDimensions} from 'react-native'

// This uses a similar mechanism to relative-popup-hoc.desktop.js. It's only
// ever used for tooltips on mobile for now. If we end up needing relative
// positioning in other places, we should probably make a
// relative-popup-hoc.native.js. Also, this only supports "bottom center" and
// "top center" for now.

const Kb = {
  Box,
  ClickableBox,
  Portal,
  Text,
}

type Dims = {
  height: number
  left: number
  top: number
  width: number
}

const FloatingBox = (props: {children: React.ReactNode; style: Styles.StylesCrossPlatform}) => (
  <Kb.Portal hostName="popup-root">
    <Kb.Box
      pointerEvents="box-none"
      style={Styles.collapseStyles([Styles.globalStyles.fillAbsolute, props.style])}
    >
      {props.children}
    </Kb.Box>
  </Kb.Portal>
)

const WithTooltip = (props: Props) => {
  const {position} = props
  const [left, setLeft] = React.useState(0)
  const [top, setTop] = React.useState(0)
  const [visible, setVisible] = React.useState(false)
  const animatedStyle = {opacity: visible ? 1 : 0}
  const clickableRef = React.useRef<View>(null)
  const tooltipRef = React.useRef<View>(null)
  const setVisibleFalseLater = useTimeout(() => {
    setVisible(false)
  }, 3000)
  const isMounted = C.useIsMounted()
  const {width: screenWidth, height: screenHeight} = useWindowDimensions()

  // since this uses portals we need to hide if we're hidden else we can get stuck showing if our render is frozen
  C.Router2.useSafeFocusEffect(
    React.useCallback(() => {
      return () => {
        setVisible(false)
      }
    }, [])
  )

  const _onClick = () => {
    if (!clickableRef.current || !tooltipRef.current || visible) {
      return
    }

    Promise.all([
      new Promise<Dims>(resolve => {
        clickableRef.current?.measure(
          (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
            resolve({height, left: pageX, top: pageY, width})
          }
        )
      }),
      new Promise<Dims>(resolve => {
        tooltipRef.current?.measure(
          (_x: number, _y: number, width: number, height: number, pageX: number, pageY: number) => {
            resolve({height, left: pageX, top: pageY, width})
          }
        )
      }),
    ] as const)
      .then(([c, t]) => {
        if (!isMounted()) {
          return
        }

        const constrainLeft = (ideal: number) => Math.max(0, Math.min(ideal, screenWidth - t.width))
        const constrainTop = (ideal: number) => Math.max(0, Math.min(ideal, screenHeight - t.height))
        if (position === 'bottom center') {
          setLeft(constrainLeft(c.left + c.width / 2 - t.width / 2))
          setTop(constrainTop(c.top + c.height))
        } else {
          // default to top center
          setLeft(constrainLeft(c.left + c.width / 2 - t.width / 2))
          setTop(constrainTop(c.top - t.height))
        }

        setVisible(true)
        setVisibleFalseLater()
      })
      .catch(() => {})
  }

  if (!props.showOnPressMobile || props.disabled) {
    return <View style={Styles.castStyleNative(props.containerStyle)}>{props.children}</View>
  }

  return (
    <>
      <View style={Styles.castStyleNative(props.containerStyle)} ref={clickableRef} collapsable={false}>
        <Kb.ClickableBox onClick={_onClick}>{props.children}</Kb.ClickableBox>
      </View>
      <FloatingBox style={animatedStyle}>
        <View pointerEvents="none" style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, {top}])}>
          <View
            style={Styles.collapseStyles([
              styles.container,
              {left},
              props.backgroundColor && {backgroundColor: props.backgroundColor},
            ])}
            ref={tooltipRef}
            collapsable={false}
          >
            <Kb.Text
              center={!props.multiline}
              type="BodySmall"
              style={Styles.collapseStyles([styles.text, props.textStyle])}
              lineClamp={props.multiline ? undefined : 1}
            >
              {props.tooltip}
            </Kb.Text>
          </View>
        </View>
      </FloatingBox>
    </>
  )
}

export default WithTooltip

const styles = Styles.styleSheetCreate(() => ({
  container: {
    backgroundColor: Styles.globalColors.black,
    borderRadius: Styles.borderRadius,
    maxWidth: 280,
    padding: Styles.globalMargins.xtiny,
  },
  text: {color: Styles.globalColors.white},
}))
