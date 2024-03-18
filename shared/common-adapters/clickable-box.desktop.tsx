import * as React from 'react'
import * as Styles from '@/styles'
import type {MeasureRef} from './measure-ref'
import type {Props as _Props, Props2} from './clickable-box'
import type {_StylesCrossPlatform} from '@/styles/css'

type Props = _Props & {children: React.ReactNode}

const ClickableBox = React.forwardRef<MeasureRef, Props>(function ClickableBox(
  props: Props,
  ref: React.Ref<MeasureRef>
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
        props.onMouseEnter?.(e)
      }
    : undefined
  const onMouseLeave = needMouseEnterLeaveHandlers
    ? (e: React.MouseEvent) => {
        setMouseIn(false)
        props.onMouseLeave?.(e)
      }
    : undefined
  const onMouseDown = (e: React.MouseEvent) => {
    setMouseDown(true)
    props.onMouseDown?.(e)
  }
  const onMouseUp = (e: React.MouseEvent) => {
    setMouseDown(false)
    props.onMouseUp?.(e)
  }

  const {
    style,
    children,
    underlayColor,
    hoverColor,
    onClick,
    onDoubleClick,
    className,
    tooltip,
    ...otherProps
  } = props

  // filter out native-only calls
  const {onPress, onLongPress, onPressIn, onPressOut, activeOpacity, feedback, ...passThroughProps} =
    otherProps

  let underlay: React.ReactNode

  if (mouseIn && props.onClick && (props.feedback || props.feedback === undefined)) {
    let borderRadius = 0
    if (style && typeof style === 'object') {
      borderRadius = ((style as _StylesCrossPlatform).borderRadius as number) || 0
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

  const divRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(
    ref,
    () => {
      return {
        divRef,
        measure() {
          return divRef.current?.getBoundingClientRect()
        },
      }
    },
    []
  )

  return (
    <div
      ref={divRef}
      className={Styles.classNames(className, {tooltip})}
      data-tooltip={tooltip}
      {...passThroughProps}
      onMouseDown={onMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onDoubleClick={onDoubleClick}
      onClick={onClick}
      style={
        Styles.collapseStyles([
          styles.container,
          onClick || props.onMouseDown ? styles.click : null,
          style,
        ]) as React.CSSProperties
      }
    >
      {underlay}
      {children}
    </div>
  )
})

const styles = Styles.styleSheetCreate(
  () =>
    ({
      click: Styles.platformStyles({
        isElectron: {
          ...Styles.desktopStyles.clickable,
        },
      }),
      container: Styles.platformStyles({
        isElectron: {
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
        },
      }),
    }) as const
)

export default ClickableBox

export const ClickableBox2 = React.forwardRef<MeasureRef, Props2>(function ClickableBox2(
  p: Props2,
  ref: React.Ref<MeasureRef>
) {
  const {onClick, children, style, className, onMouseOver} = p
  const collapsed = Styles.useCollapseStyles(style, true)
  const divRef = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => {
    return {
      divRef,
      measure() {
        return divRef.current?.getBoundingClientRect()
      },
    }
  })
  return (
    <div
      onClick={onClick}
      onMouseOver={onMouseOver}
      style={collapsed as any}
      ref={divRef}
      className={Styles.classNames('clickable-box2', className)}
    >
      {children}
    </div>
  )
})
