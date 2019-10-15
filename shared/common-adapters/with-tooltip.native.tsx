import * as React from 'react'
import {NativeDimensions, NativeView} from './native-wrappers.native'
import FloatingBox from './floating-box'
import {useTimeout} from './use-timers'
import useMounted from './use-mounted'
import ClickableBox from './clickable-box'
import Text from './text'
import Animated from './animated'
import * as Styles from '../styles'
import {Props} from './with-tooltip'

// This uses a similar mechanism to relative-popup-hoc.desktop.js. It's only
// ever used for tooltips on mobile for now. If we end up needing relative
// positioning in other places, we should probably make a
// relative-popup-hoc.native.js. Also, this only supports "bottom center" and
// "top center" for now.

const Kb = {
  Animated,
  ClickableBox,
  FloatingBox,
  NativeDimensions,
  NativeView,
  Text,
}

type Dims = {
  height: number
  left: number
  top: number
  width: number
}
const measureCb = (resolve: (dims: Dims) => void) => (
  _x: number,
  _y: number,
  width: number,
  height: number,
  pageX: number,
  pageY: number
) => resolve({height, left: pageX, top: pageY, width})

const WithTooltip = (props: Props) => {
  const {position} = props
  const [left, setLeft] = React.useState(0)
  const [top, setTop] = React.useState(0)
  const [visible, setVisible] = React.useState(false)
  const clickableRef = React.useRef<NativeView>(null)
  const tooltipRef = React.useRef<NativeView>(null)
  const setVisibleFalseLater = useTimeout(() => {
    setVisible(false)
  }, 3000)
  const getIsMounted = useMounted()
  const _onClick = () => {
    if (!clickableRef.current || !tooltipRef.current || visible) {
      return
    }

    const screenWidth = Kb.NativeDimensions.get('window').width
    const screenHeight = Kb.NativeDimensions.get('window').height

    Promise.all([
      new Promise(resolve => clickableRef.current && clickableRef.current.measure(measureCb(resolve))),
      new Promise(resolve => tooltipRef.current && tooltipRef.current.measure(measureCb(resolve))),
      // @ts-ignore this stucture makes this very hard to type
    ]).then(([c, t]: [Dims, Dims]) => {
      if (!getIsMounted()) {
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
  }

  if (!props.showOnPressMobile || props.disabled) {
    return <Kb.NativeView style={props.containerStyle as any}>{props.children}</Kb.NativeView>
  }

  return (
    <>
      <Kb.NativeView style={props.containerStyle as any} ref={clickableRef}>
        <Kb.ClickableBox onClick={_onClick}>{props.children}</Kb.ClickableBox>
      </Kb.NativeView>
      <Kb.Animated from={{}} to={{opacity: visible ? 1 : 0}}>
        {animatedStyle => (
          <Kb.FloatingBox>
            <Kb.NativeView
              pointerEvents="none"
              style={Styles.collapseStyles([Styles.globalStyles.flexBoxRow, {top}])}
            >
              <Kb.NativeView
                style={Styles.collapseStyles([
                  animatedStyle,
                  styles.container,
                  {left},
                  props.backgroundColor && {backgroundColor: props.backgroundColor},
                ])}
                ref={tooltipRef}
              >
                <Kb.Text
                  center={!props.multiline}
                  type="BodySmall"
                  style={Styles.collapseStyles([styles.text, props.textStyle])}
                  lineClamp={props.multiline ? undefined : 1}
                >
                  {props.tooltip}
                </Kb.Text>
              </Kb.NativeView>
            </Kb.NativeView>
          </Kb.FloatingBox>
        )}
      </Kb.Animated>
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
  text: {
    color: Styles.globalColors.white,
  },
}))
