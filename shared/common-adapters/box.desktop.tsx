import * as React from 'react'
import * as Styles from '@/styles'
import type {Box2Props, Props} from './box'
import type {MeasureRef} from './measure-ref'
import './box.css'

export const Box = (p: Props) => {
  const {style, onLayout, tooltip, className, ...rest} = p
  return (
    <div
      {...rest}
      style={Styles.castStyleDesktop(style)}
      className={Styles.classNames(className, {tooltip})}
      data-tooltip={tooltip}
    />
  )
}

const useBox2Shared = (p: Box2Props) => {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = p
  const {onMouseMove, onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children} = p
  const {onContextMenu, gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop} = p
  const {style: _style, className: _className, title, tooltip} = p
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'

  // let style = props.style
  // uncomment this to get debugging colors
  // style = {
  //   ...style,
  //   backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
  // }

  const style = Styles.collapseStyles([_style]) as unknown as React.CSSProperties

  const className = Styles.classNames(
    {
      [`box2_alignItems_${alignItems ?? ''}`]: alignItems,
      [`box2_alignSelf_${alignSelf ?? ''}`]: alignSelf,
      [`box2_gapEnd_${gap ?? ''}`]: gapEnd,
      [`box2_gapStart_${gap ?? ''}`]: gapStart,
      [`box2_gap_${gap ?? ''}`]: gap,
      box2_centered: !fullHeight && !fullWidth,
      box2_centeredChildren: centerChildren,
      box2_fullHeight: fullHeight,
      box2_fullWidth: fullWidth,
      box2_horizontal: horizontal,
      box2_no_shrink: noShrink,
      box2_pointerEvents_none: pointerEvents === 'none',
      box2_reverse: reverse,
      box2_vertical: !horizontal,
      tooltip,
    },
    _className
  )
  return {
    children,
    className,
    'data-tooltip': tooltip,
    onContextMenu,
    onCopyCapture,
    onDragLeave,
    onDragOver,
    onDrop,
    onMouseDown,
    onMouseLeave,
    onMouseMove,
    onMouseOver,
    onMouseUp,
    style,
    title,
  }
}

export const Box2 = (p: Box2Props) => {
  const props = useBox2Shared(p)
  return <div {...props} />
}

export const Box2Div = React.forwardRef<HTMLDivElement, Box2Props>(function Box2Animated(p, ref) {
  const props = useBox2Shared(p)
  return <div {...props} ref={ref} />
})
export const Box2Animated = Box2Div

export const Box2View = () => {
  throw new Error('Wrong platform')
}

export const Box2Measure = React.forwardRef<MeasureRef, Box2Props>(function Box2(p, ref) {
  const props = useBox2Shared(p)
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

  return <div ref={divRef} {...props} />
})

export default Box
