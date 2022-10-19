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

const _Box2 = (props: Box2Props, ref: React.Ref<HTMLDivElement>) => {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = props
  const {onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children, style} = props
  const {gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop, className} = props
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
      className={[
        `box2_${horizontal ? 'horizontal' : 'vertical'}`,
        reverse && 'box2_reverse',
        fullHeight && 'box2_fullHeight',
        fullWidth && 'box2_fullWidth',
        !fullHeight && !fullWidth && 'box2_centered',
        centerChildren && 'box2_centeredChildren',
        alignSelf && `box2_alignSelf_${alignSelf}`,
        alignItems && `box2_alignItems_${alignItems}`,
        noShrink && 'box2_no_shrink',
        pointerEvents === 'none' && 'box2_pointerEvents_none',
        gap && `box2_gap_${gap}`,
        gapStart && `box2_gapStart_${gap}`,
        gapEnd && `box2_gapEnd_${gap}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={collapsedStyle}
    >
      {children}
    </div>
  )
}

export const Box2 = React.forwardRef<HTMLDivElement, Box2Props>(_Box2)

export default Box
