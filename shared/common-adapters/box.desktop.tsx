import type * as React from 'react'
import * as Styles from '@/styles'
import type {Box2Props} from './box'
import './box.css'

export const Box2 = (p: Box2Props & {ref?: React.Ref<HTMLDivElement>}) => {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink, ref} = p
  const {flex, justifyContent, overflow, padding, relative} = p
  const {onMouseMove, onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children} = p
  const {onContextMenu, gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop} = p
  const {style: _style, className: _className, title, tooltip} = p
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'

  const style = Styles.collapseStyles([
    flex != null && flex !== 1 ? {flex} : undefined,
    _style,
  ]) as unknown as React.CSSProperties

  const className = Styles.classNames(
    {
      [`box2_alignItems_${alignItems ?? ''}`]: alignItems,
      [`box2_alignSelf_${alignSelf ?? ''}`]: alignSelf,
      [`box2_gapEnd_${gap ?? ''}`]: gapEnd,
      [`box2_gapStart_${gap ?? ''}`]: gapStart,
      [`box2_gap_${gap ?? ''}`]: gap,
      [`box2_justifyContent_${justifyContent ?? ''}`]: justifyContent,
      [`box2_overflow_${overflow ?? ''}`]: overflow,
      [`box2_padding_${padding ?? ''}`]: padding,
      box2_centered: !fullHeight && !fullWidth,
      box2_centeredChildren: centerChildren,
      box2_flex1: flex === 1,
      box2_fullHeight: fullHeight,
      box2_fullWidth: fullWidth,
      box2_horizontal: horizontal,
      box2_no_shrink: noShrink,
      box2_pointerEvents_none: pointerEvents === 'none',
      box2_relative: relative,
      box2_reverse: reverse,
      box2_vertical: !horizontal,
      tooltip,
    },
    _className
  )

  return (
    <div
      ref={ref}
      className={className}
      data-tooltip={tooltip}
      onContextMenu={onContextMenu}
      onCopyCapture={onCopyCapture}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseMove={onMouseMove}
      onMouseOver={onMouseOver}
      onMouseUp={onMouseUp}
      style={style}
      title={title}
      children={children}
    />
  )
}

export const Box2Animated = Box2
