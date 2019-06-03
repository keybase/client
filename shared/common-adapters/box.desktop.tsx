import * as React from 'react'
import {intersperseFn} from '../util/arrays'
import {Box2Props} from './box'

class Box extends React.PureComponent<any> {
  render() {
    const {forwardedRef, ...rest} = this.props
    return <div {...rest} ref={this.props.forwardedRef} />
  }
}

const injectGaps = (component, _children, gap, gapStart, gapEnd) => {
  let children = _children
  if (gap) {
    children = intersperseFn(index => component(index, gap), React.Children.toArray(_children))
    if (gapStart) {
      children.unshift(component('gapStart', gap))
    }
    if (gapEnd) {
      children.push(component('gapEnd', gap))
    }
  }

  return children
}

const box2 = (props: Box2Props) => {
  let horizontal = props.direction === 'horizontal' || props.direction === 'horizontalReverse'

  const className = [
    `box2_${props.direction}`,
    props.fullHeight && 'box2_fullHeight',
    props.fullWidth && 'box2_fullWidth',
    !props.fullHeight && !props.fullWidth && 'box2_centered',
    props.centerChildren && 'box2_centeredChildren',
    props.alignSelf && `box2_alignSelf_${props.alignSelf}`,
    props.alignItems && `box2_alignItems_${props.alignItems}`,
    props.noShrink && 'box2_no_shrink',
    props.pointerEvents === 'none' && 'box2_pointerEvents_none',
    props.className,
  ]
    .filter(Boolean)
    .join(' ')

  let style = props.style
  // uncomment this to get debugging colors
  // style = {
  //   ...style,
  //   backgroundColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
  // }
  return (
    <div
      onDragLeave={props.onDragLeave}
      onDragOver={props.onDragOver}
      onDrop={props.onDrop}
      onMouseLeave={props.onMouseLeave}
      onMouseOver={props.onMouseOver}
      onCopyCapture={props.onCopyCapture}
      className={className}
      style={(style as unknown) as React.CSSProperties}
    >
      {injectGaps(horizontal ? hBoxGap : vBoxGap, props.children, props.gap, props.gapStart, props.gapEnd)}
    </div>
  )
}

class Box2 extends React.Component<Box2Props> {
  render() {
    return box2(this.props)
  }
}

const vBoxGap = (key, gap) => <div key={key} className={`box2_gap_vertical_${gap}`} />
const hBoxGap = (key, gap) => <div key={key} className={`box2_gap_horizontal_${gap}`} />

export default Box
export {Box, Box2}
