// @flow
import * as React from 'react'
import {intersperseFn} from '../util/arrays'
import type {Box2Props} from './box'

class Box extends React.Component<any> {
  render() {
    return <div {...this.props} />
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
    props.className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      onMouseLeave={props.onMouseLeave}
      onMouseOver={props.onMouseOver}
      className={className}
      style={props.style}
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
