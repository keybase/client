import * as React from 'react'
import * as Styles from '@/styles'
import {Pressable, View, TouchableOpacity, TouchableWithoutFeedback} from 'react-native'
import type {_StylesCrossPlatform} from '@/styles/css'
import type {MeasureRef} from './measure-ref'

type Props = {
  className?: string
  children?: React.ReactNode
  style?: Styles.StylesCrossPlatform
  onClick?: (event: React.BaseSyntheticEvent) => void
  onDoubleClick?: (event: React.BaseSyntheticEvent) => void
  onPress?: never
  onLongPress?: (event: React.BaseSyntheticEvent) => void
  underlayColor?: string
  onPressIn?: () => void
  onPressOut?: () => void
  feedback?: boolean
  activeOpacity?: number
  hoverColor?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onMouseEnter?: (event: React.MouseEvent) => void
  onMouseLeave?: (event: React.MouseEvent) => void
  onMouseDown?: (event: React.MouseEvent) => void
  onMouseMove?: (event: React.MouseEvent) => void
  onMouseUp?: (event: React.MouseEvent) => void
  title?: string
  tooltip?: string
}

type Props2 = {
  onLongPress?: () => void
  hitSlop?: number
  testID?: string
  onMouseOver?: (event: React.MouseEvent) => void
  onClick?: () => void
  children: React.ReactNode
  className?: string
  style?: Styles.StylesCrossPlatform
}

const ClickableBox = (props: Props & {children: React.ReactNode; ref?: React.Ref<MeasureRef | null>}) => {
  const {ref} = props
  const [mouseDown, setMouseDown] = React.useState(false)
  const [mouseIn, setMouseIn] = React.useState(false)

  if (!isMobile) {
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
      ref: _ref,
      ...otherProps
    } = props

    const {onPress, onLongPress, onPressIn, onPressOut, activeOpacity, feedback, ...passThroughProps} =
      otherProps

    let underlay: React.ReactNode
    if (mouseIn && props.onClick && (props.feedback || props.feedback === undefined)) {
      let borderRadius = 0
      if (style && typeof style === 'object') {
        borderRadius = ((style as _StylesCrossPlatform).borderRadius as number) || 0
      }
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
        ref={ref as React.Ref<HTMLDivElement>}
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
            desktopStyles.container,
            onClick || props.onMouseDown ? desktopStyles.click : null,
            style,
          ]) as React.CSSProperties
        }
      >
        {underlay}
        {children}
      </div>
    )
  }

  const {feedback = true, onClick, onPressIn, onPressOut, onLongPress} = props
  const {style, activeOpacity, children} = props

  if (onClick) {
    const clickStyle = Styles.collapseStyles([nativeStyles.box, style])
    if (feedback) {
      return (
        <TouchableOpacity
          disabled={!onClick}
          onPress={onClick}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onLongPress={onLongPress}
          style={clickStyle}
          activeOpacity={activeOpacity ?? 0.7}
        >
          {children}
        </TouchableOpacity>
      )
    } else {
      return (
        <TouchableWithoutFeedback
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={onClick}
          onLongPress={onLongPress}
        >
          <View style={clickStyle}>{children}</View>
        </TouchableWithoutFeedback>
      )
    }
  } else {
    if (__DEV__) {
      if (onPressIn || onPressOut || onLongPress) {
        console.warn("Passed onPress*/on*Press with no onPress, which isn't supported on the native side")
      }
    }
    return <View style={style}>{children}</View>
  }
}

const desktopStyles = Styles.styleSheetCreate(
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

const nativeStyles = Styles.styleSheetCreate(() => ({
  box: {borderRadius: 3},
}))

export default ClickableBox

export const ClickableBox2 = (p: Props2 & {ref?: React.Ref<MeasureRef | null>}) => {
  if (!isMobile) {
    const {onClick, children, style, className, onMouseOver, ref, testID} = p
    return (
      <div
        onClick={onClick}
        onMouseOver={onMouseOver}
        style={Styles.castStyleDesktop(style)}
        ref={ref as React.Ref<HTMLDivElement>}
        className={Styles.classNames('clickable-box2', className)}
        data-testid={testID}
      >
        {children}
      </div>
    )
  }
  const {onLongPress, onClick, children, hitSlop, style, testID} = p
  const onPress = () => {
    onClick?.()
  }
  return (
    <Pressable onLongPress={onLongPress} onPress={onPress} style={style} hitSlop={hitSlop} testID={testID}>
      {children}
    </Pressable>
  )
}
