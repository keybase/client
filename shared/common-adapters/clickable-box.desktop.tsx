import * as React from 'react'
import * as Styles from '../styles'

import type {Props as _Props, Props2} from './clickable-box'
import type {_StylesCrossPlatform} from '../styles/css'

type Props = _Props & {children: React.ReactNode}

const ClickableBox = React.forwardRef<HTMLDivElement, Props>(function ClickableBox(
  props: Props,
  forwardedRef: React.Ref<HTMLDivElement>
) {
  const [mouseDown, setMouseDown] = React.useState(false)
  const [mouseIn, setMouseIn] = React.useState(false)

  // Set onMouseEnter/Leave only if needed, so that any hover
  // properties of children elements work.
  const needMouseEnterLeaveHandlers = !!(
    props.hoverColor ||
    props.underlayColor ||
    props.onMouseEnter ||
    props.onMouseLeave
  )
  const onMouseEnter = needMouseEnterLeaveHandlers
    ? (e: React.MouseEvent): void => {
        setMouseIn(true)
        props.onMouseEnter && props.onMouseEnter(e)
      }
    : undefined
  const onMouseLeave = needMouseEnterLeaveHandlers
    ? (e: React.MouseEvent) => {
        setMouseIn(false)
        props.onMouseLeave && props.onMouseLeave(e)
      }
    : undefined
  const onMouseDown = (e: React.MouseEvent) => {
    setMouseDown(true)
    props.onMouseDown && props.onMouseDown(e)
  }
  const onMouseUp = (e: React.MouseEvent) => {
    setMouseDown(false)
    props.onMouseUp && props.onMouseUp(e)
  }

  const {style, children, underlayColor, hoverColor, onClick, onDoubleClick, ...otherProps} = props

  // filter out native-only calls
  const {
    onPress,
    onLongPress,
    onPressIn,
    onPressOut,
    activeOpacity,
    pointerEvents,
    feedback,
    ...passThroughProps
  } = otherProps

  let underlay: React.ReactNode

  if (mouseIn && props.onClick && (props.feedback || props.feedback === undefined)) {
    let borderRadius = 0
    if (style && typeof style === 'object') {
      borderRadius = (style as _StylesCrossPlatform).borderRadius || 0
    }
    // Down or hover
    const backgroundColor = mouseDown
      ? underlayColor || 'rgba(255, 255, 255, 0.2)'
      : hoverColor || 'rgba(255, 255, 255, 0.1)'
    underlay = (
      <div
        style={{
          ...Styles.globalStyles.fillAbsolute,
          backgroundColor,
          borderRadius,
        }}
      />
    )
  }

  return (
    <div
      ref={forwardedRef}
      {...passThroughProps}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      style={Styles.collapseStyles([
        _containerStyle,
        onClick || props.onMouseDown ? Styles.desktopStyles.clickable : null,
        style,
      ] as any)}
    >
      {underlay}
      {children}
    </div>
  )
})

const _containerStyle = {
  alignItems: 'stretch',
  borderRadius: 0,
  display: 'flex',
  flexDirection: 'column',
  height: undefined,
  lineHeight: 0,
  minWidth: undefined,
  position: 'relative',
  textAlign: 'left',
  transform: 'none',
  transition: 'none',
}

export default ClickableBox

export const ClickableBox2 = (p: Props2) => {
  const {onClick, children, style, className, onMouseOver} = p
  const collapsed = Styles.useCollapseStyles(style, true)
  return (
    <div
      onClick={onClick}
      onMouseOver={onMouseOver}
      style={collapsed}
      className={Styles.classNames('clickable-box2', className)}
    >
      {children}
    </div>
  )
}
