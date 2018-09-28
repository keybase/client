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

class Box2 extends React.Component<Box2Props> {
  render() {
    let horizontal = this.props.direction === 'horizontal' || this.props.direction === 'horizontalReverse'

    const className = [
      `box2_${this.props.direction}`,
      this.props.fullHeight && 'box2_fullHeight',
      this.props.fullWidth && 'box2_fullWidth',
      !this.props.fullHeight && !this.props.fullWidth && 'box2_centered',
      this.props.centerChildren && 'box2_centeredChildren',
      this.props.style,
      this.props.className,
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div onMouseLeave={this.props.onMouseLeave} onMouseOver={this.props.onMouseOver} className={className}>
        {injectGaps(
          horizontal ? hBoxGap : vBoxGap,
          this.props.children,
          this.props.gap,
          this.props.gapStart,
          this.props.gapEnd
        )}
      </div>
    )
  }
}

const vBoxGap = (key, gap) => <div key={key} className={`box2_gap_vertical_${gap}`} />
const hBoxGap = (key, gap) => <div key={key} className={`box2_gap_horizontal_${gap}`} />

export default Box
export {Box, Box2}
