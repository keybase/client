import * as React from 'react'
import * as Styles from '@/styles'
import type {_StylesCrossPlatform} from '@/styles/css'
import type {MeasureRef} from '@/common-adapters/measure-ref'


type _Props = {
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
type Props = _Props & {children: React.ReactNode}

const ClickableBox = (props: Props & {ref?: React.Ref<MeasureRef>}) => {
  const {ref} = props
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
    ref: _ref,
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
          styles.container,
          onClick || props.onMouseDown ? styles.click : null,
          style,
        ])
      }
    >
      {underlay}
      {children}
    </div>
  )
}

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

export const ClickableBox2 = (p: Props2 & {ref?: React.Ref<MeasureRef>}) => {
  const {onClick, children, style, className, onMouseOver, ref} = p
  return (
    <div
      onClick={onClick}
      onMouseOver={onMouseOver}
      style={Styles.castStyleDesktop(style)}
      ref={ref as React.Ref<HTMLDivElement>}
      className={Styles.classNames('clickable-box2', className)}
    >
      {children}
    </div>
  )
}
