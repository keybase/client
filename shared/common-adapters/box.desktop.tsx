import * as React from 'react'
import * as Styles from '../styles'
import {intersperseFn} from '../util/arrays'
import {Box2Props} from './box'
import './box.css'

export class Box extends React.PureComponent<any> {
  render() {
    const {forwardedRef, onLayout, ...rest} = this.props
    return <div {...rest} ref={this.props.forwardedRef} />
  }
}

type Margins = keyof typeof Styles.globalMargins
const marginKeys: Array<Margins> = Object.keys(Styles.globalMargins) as any

// premake the gaps and cache them forever so we can take advantage of react optimizing them if they're the same
const vgaps = new Map(
  marginKeys.map(gap => [
    gap,
    new Array(100)
      .fill('')
      .map((_, idx) => <div key={'vgap-' + idx} className={`box2_gap_vertical_${gap}`} />),
  ])
)
const hgaps = new Map(
  marginKeys.map(gap => [
    gap,
    new Array(100)
      .fill('')
      .map((_, idx) => <div key={'hgap-' + idx} className={`box2_gap_horizontal_${gap}`} />),
  ])
)

const _Box2 = (props: Box2Props, ref: React.Ref<HTMLDivElement>) => {
  const {direction, fullHeight, fullWidth, centerChildren, alignSelf, alignItems, noShrink} = props
  const {onMouseDown, onMouseLeave, onMouseUp, onMouseOver, onCopyCapture, children} = props
  const {gap, gapStart, gapEnd, pointerEvents, onDragLeave, onDragOver, onDrop, className} = props
  const horizontal = direction === 'horizontal' || direction === 'horizontalReverse'

  let style = props.style
  // uncomment this to get debugging colors
  // style = {
  //   ...style,
  //   backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
  // }

  let gappedChildren: Array<React.ReactNode> = children as any
  if (gap && (gapStart || gapEnd || React.Children.count(children) > 1)) {
    let gapIdx = 1
    const gapList = horizontal ? hgaps.get(gap)! : vgaps.get(gap)!
    gappedChildren = intersperseFn(() => gapList[gapIdx++], React.Children.toArray(gappedChildren))
    if (gapStart) {
      gappedChildren.unshift(gapList[0])
    }
    if (gapEnd) {
      gappedChildren.push(gapList[gapIdx])
    }
  }

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
        `box2_${direction}`,
        fullHeight && 'box2_fullHeight',
        fullWidth && 'box2_fullWidth',
        !fullHeight && !fullWidth && 'box2_centered',
        centerChildren && 'box2_centeredChildren',
        alignSelf && `box2_alignSelf_${alignSelf}`,
        alignItems && `box2_alignItems_${alignItems}`,
        noShrink && 'box2_no_shrink',
        pointerEvents === 'none' && 'box2_pointerEvents_none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={(Styles.collapseStyles([style]) as unknown) as React.CSSProperties}
    >
      {gappedChildren}
    </div>
  )
}

export const Box2 = React.forwardRef<HTMLDivElement, Box2Props>(_Box2)

export default Box
