import * as React from 'react'
import * as Styles from '../styles'
import type {Box2Props} from './box'
import './box.css'

export class Box extends React.PureComponent<any> {
  render() {
    const {forwardedRef, onLayout, ...rest} = this.props
    return <div {...rest} ref={this.props.forwardedRef} />
  }
}

export const Box2 = React.forwardRef<HTMLDivElement, Box2Props>(function Box2(
  props: Box2Props,
  ref: React.Ref<HTMLDivElement>
) {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = props
  const {onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children, style} = props
  const {gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop, className} = props
  const {onContextMenu} = props
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'
  const reverse = direction === 'verticalReverse' || direction === 'horizontalReverse'

  // let style = props.style
  // uncomment this to get debugging colors
  // style = {
  //   ...style,
  //   backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
  // }

  const collapsedStyle = Styles.collapseStyles([style]) as unknown as React.CSSProperties

  return (
    <div
      ref={ref}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onMouseDown={onMouseDown}
      onMouseLeave={onMouseLeave}
      onMouseUp={onMouseUp}
      onMouseOver={onMouseOver}
      onCopyCapture={onCopyCapture}
      onContextMenu={onContextMenu}
      className={Styles.classNames(
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
        },
        className
      )}
      style={collapsedStyle}
    >
      {children}
    </div>
  )
})

export default Box
